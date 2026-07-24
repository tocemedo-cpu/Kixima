// src/services/marketplaceService.js
// Pesquisa do marketplace: paginação no backend, filtros e ordenação seguros.
const prisma = require('../config/database');

const SORTS = {
  relevantes: [{ reviewCount: 'desc' }, { rating: 'desc' }, { createdAt: 'desc' }],
  recentes: [{ createdAt: 'desc' }],
  avaliacao: [{ rating: 'desc' }, { reviewCount: 'desc' }],
  preco_asc: [{ unitPrice: 'asc' }],
  preco_desc: [{ unitPrice: 'desc' }],
  solicitados: [{ viewCount: 'desc' }],
  vendidos: [{ reviewCount: 'desc' }, { viewCount: 'desc' }], // proxy até haver contador de vendas
};

const SUPPLIER = { select: { id: true, name: true, verified: true, logoUrl: true } };

// Constrói o `where` do Prisma a partir de parâmetros já validados/saneados.
function buildWhere(f) {
  const where = { active: true };
  if (f.kind) where.kind = f.kind;
  if (f.category) where.category = f.category;
  if (f.availability) where.availability = f.availability;
  if (f.country) where.country = f.country;
  if (f.province) where.province = f.province;
  if (f.city) where.city = f.city;
  if (f.specialty) where.specialty = f.specialty;
  if (f.minRating) where.rating = { gte: f.minRating };
  if (f.minPrice != null || f.maxPrice != null) {
    where.unitPrice = {};
    if (f.minPrice != null) where.unitPrice.gte = f.minPrice;
    if (f.maxPrice != null) where.unitPrice.lte = f.maxPrice;
  }
  if (f.certifications?.length) where.certifications = { hasSome: f.certifications };
  if (f.verified) where.supplier = { is: { verified: true } };
  if (f.excludeSupplierId) where.supplierId = { not: f.excludeSupplierId };
  if (f.q) {
    const q = f.q;
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { specialty: { contains: q, mode: 'insensitive' } },
      { category: { contains: q, mode: 'insensitive' } },
      { city: { contains: q, mode: 'insensitive' } },
      { tags: { has: q } },
      { supplier: { is: { name: { contains: q, mode: 'insensitive' } } } },
    ];
  }
  return where;
}

async function search(filters, { userId } = {}) {
  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(48, Math.max(1, filters.limit || 16));
  const where = buildWhere(filters);
  const orderBy = SORTS[filters.sort] || SORTS.relevantes;

  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where, orderBy, skip: (page - 1) * limit, take: limit,
      include: { supplier: SUPPLIER },
    }),
  ]);

  // Marca favoritos do utilizador autenticado (uma consulta só).
  let favSet = new Set();
  if (userId && rows.length) {
    const favs = await prisma.favorite.findMany({
      where: { userId, productId: { in: rows.map((r) => r.id) } },
      select: { productId: true },
    });
    favSet = new Set(favs.map((f) => f.productId));
  }

  const items = rows.map((p) => ({ ...p, isFavorite: favSet.has(p.id) }));
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)), limit };
}

// Facetas (contagens) para os filtros — respeitam kind/pesquisa mas não a
// categoria escolhida, para mostrar sempre todas as categorias disponíveis.
async function facets(filters) {
  const base = buildWhere({ ...filters, category: undefined });
  const byCategory = await prisma.product.groupBy({
    by: ['category'], where: base, _count: { _all: true }, orderBy: { _count: { category: 'desc' } },
  });
  return {
    categories: byCategory.map((c) => ({ name: c.category, count: c._count._all })),
  };
}

// Fornecedores verificados (para a home) — com rating médio dos seus produtos.
async function verifiedSuppliers(limit = 8) {
  const suppliers = await prisma.company.findMany({
    where: { type: 'FORNECEDOR', verified: true, status: 'APROVADA' },
    select: { id: true, name: true, logoUrl: true, city: true, country: true },
    take: limit,
  });
  const withRating = await Promise.all(suppliers.map(async (s) => {
    const agg = await prisma.product.aggregate({
      where: { supplierId: s.id, active: true },
      _avg: { rating: true }, _count: { _all: true },
    });
    return { ...s, rating: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : null, productCount: agg._count._all };
  }));
  return withRating.sort((a, b) => (b.rating || 0) - (a.rating || 0));
}

module.exports = { search, facets, verifiedSuppliers };
