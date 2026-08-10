// src/services/marketplaceService.js
// Pesquisa do marketplace: paginação no backend, filtros e ordenação seguros.
const prisma = require('../config/database');
const { NotFoundError } = require('../utils/errors');

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
  if (f.promo) where.promoPrice = { not: null };
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

// Facetas (contagens) para os filtros. Cada faceta ignora o seu próprio filtro
// para continuar a mostrar todas as opções disponíveis.
async function facets(filters) {
  const [byCategory, byKind, byCountry, certRows, priceAgg] = await Promise.all([
    prisma.product.groupBy({
      by: ['category'], where: buildWhere({ ...filters, category: undefined }),
      _count: { _all: true }, orderBy: { _count: { category: 'desc' } },
    }),
    prisma.product.groupBy({
      by: ['kind'], where: buildWhere({ ...filters, kind: undefined }), _count: { _all: true },
    }),
    prisma.product.groupBy({
      by: ['country'], where: buildWhere({ ...filters, country: undefined }), _count: { _all: true },
    }),
    prisma.product.findMany({
      where: buildWhere({ ...filters, certifications: undefined }), select: { certifications: true },
    }),
    // Limites de preço (ignora o próprio filtro de preço) para o slider/hint.
    prisma.product.aggregate({
      where: buildWhere({ ...filters, minPrice: undefined, maxPrice: undefined }),
      _min: { unitPrice: true }, _max: { unitPrice: true },
    }),
  ]);

  // Certificações são um array por produto — conta-se em memória.
  const certCount = new Map();
  for (const r of certRows) for (const c of r.certifications || []) certCount.set(c, (certCount.get(c) || 0) + 1);

  return {
    categories: byCategory.map((c) => ({ name: c.category, count: c._count._all })),
    kinds: byKind.map((k) => ({ name: k.kind, count: k._count._all })),
    countries: byCountry.filter((c) => c.country).map((c) => ({ name: c.country, count: c._count._all })),
    certifications: [...certCount.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    priceBounds: { min: Number(priceAgg._min.unitPrice) || 0, max: Number(priceAgg._max.unitPrice) || 0 },
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

// Comparação de fornecedores para um produto (só comprador). Reúne até 5 ofertas
// do MESMO item (mesmo código UNSPSC; senão, mesma categoria), de fornecedores
// diferentes, para comparar preço, prazo, material, garantia, norma, origem,
// incoterm e avaliação. Exclui os produtos da própria empresa do comprador.
const COMPARE_SELECT = {
  id: true, name: true, unitPrice: true, promoPrice: true, currency: true,
  leadTimeDays: true, material: true, warranty: true, standard: true, keySpec: true,
  certifications: true, countryOfOrigin: true, incoterm: true, availability: true,
  rating: true, reviewCount: true, unspscCode: true, category: true,
  supplier: { select: { id: true, name: true, verified: true, city: true, country: true } },
};

async function compareSuppliers(productId, { excludeSupplierId } = {}) {
  const base = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, unspscCode: true, unspscTitle: true, category: true },
  });
  if (!base) throw new NotFoundError('Produto');

  const where = { active: true };
  if (base.unspscCode) where.unspscCode = base.unspscCode;
  else where.category = base.category;
  if (excludeSupplierId) where.supplierId = { not: excludeSupplierId };

  const rows = await prisma.product.findMany({
    where, select: COMPARE_SELECT, orderBy: { unitPrice: 'asc' }, take: 5,
  });
  // Preço efetivo (promo se houver) e ordenação por esse valor.
  const offers = rows
    .map((o) => ({ ...o, effectivePrice: Number(o.promoPrice ?? o.unitPrice) || 0 }))
    .sort((a, b) => a.effectivePrice - b.effectivePrice);

  return {
    base: { name: base.name, unspscCode: base.unspscCode, unspscTitle: base.unspscTitle, category: base.category },
    offers,
    count: offers.length,
  };
}

module.exports = { search, facets, verifiedSuppliers, compareSuppliers };
