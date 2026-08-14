// src/services/marketplaceService.js
// Pesquisa do marketplace: paginação no backend, filtros e ordenação seguros.
const prisma = require('../config/database');
const { NotFoundError } = require('../utils/errors');

// A POSIÇÃO DO PLANO SÓ ENTRA NA RELEVÂNCIA — e é uma decisão de produto, não
// uma omissão. Quem escolhe "preço mais baixo" quer o preço mais baixo; se o
// plano do fornecedor passasse à frente disso, o controlo de ordenação passaria
// a mentir, e um comprador que descobre que a ordenação não é o que diz perde a
// confiança na pesquisa toda. Isso custa mais ao marketplace do que a
// diferenciação de planos lhe rende.
const RANK_DO_PLANO = { supplier: { searchRank: 'desc' } };

const SORTS = {
  relevantes: [RANK_DO_PLANO, { reviewCount: 'desc' }, { rating: 'desc' }, { createdAt: 'desc' }],
  recentes: [{ createdAt: 'desc' }],
  avaliacao: [{ rating: 'desc' }, { reviewCount: 'desc' }],
  preco_asc: [{ unitPrice: 'asc' }],
  preco_desc: [{ unitPrice: 'desc' }],
  solicitados: [{ viewCount: 'desc' }],
  vendidos: [{ reviewCount: 'desc' }, { viewCount: 'desc' }], // proxy até haver contador de vendas
};

// `searchRank` vai no select para a interface poder mostrar o selo do Pro.
const SUPPLIER = { select: { id: true, name: true, verified: true, logoUrl: true, searchRank: true } };

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

// Comparação de fornecedores para um produto (só comprador). Ao clicar num
// produto, o sistema faz uma VARREDURA e encontra fornecedores que vendem o
// MESMO produto — mesmo código UNSPSC ou mesmo nome (sem acentos/caixa). Nunca
// agrupa por categoria genérica (misturaria produtos diferentes). Devolve UMA
// oferta por fornecedor (a mais barata), até 5, para comparar preço, prazo,
// material, garantia, norma, origem, incoterm e avaliação. Exclui os produtos
// da própria empresa do comprador.
const COMPARE_SELECT = {
  id: true, name: true, unitPrice: true, promoPrice: true, currency: true,
  leadTimeDays: true, material: true, warranty: true, standard: true, keySpec: true,
  certifications: true, countryOfOrigin: true, incoterm: true, availability: true,
  rating: true, reviewCount: true, unspscCode: true, category: true,
  supplier: { select: { id: true, name: true, verified: true, city: true, country: true } },
};

// Normaliza um nome para comparação: sem acentos, caixa baixa, espaços únicos.
const normName = (s) => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/\s+/g, ' ').trim();

async function compareSuppliers(productId, { excludeSupplierId } = {}) {
  const base = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, unspscCode: true, unspscTitle: true, category: true },
  });
  if (!base) throw new NotFoundError('Produto');

  // Varredura: mesmo produto = mesmo código UNSPSC OU mesmo nome.
  const sameProduct = [{ name: { equals: base.name, mode: 'insensitive' } }];
  if (base.unspscCode) sameProduct.unshift({ unspscCode: base.unspscCode });

  const where = { active: true, OR: sameProduct };
  if (excludeSupplierId) where.supplierId = { not: excludeSupplierId };

  const rows = await prisma.product.findMany({
    where, select: COMPARE_SELECT, orderBy: { unitPrice: 'asc' }, take: 40,
  });

  // Defesa extra no nome (acentos) + preço efetivo (promo se houver).
  const baseName = normName(base.name);
  const matches = rows
    .filter((o) => (base.unspscCode && o.unspscCode === base.unspscCode) || normName(o.name) === baseName)
    .map((o) => ({ ...o, effectivePrice: Number(o.promoPrice ?? o.unitPrice) || 0 }));

  // A comparação é entre FORNECEDORES: uma oferta por fornecedor (a mais barata).
  const bySupplier = new Map();
  for (const o of matches) {
    const cur = bySupplier.get(o.supplier.id);
    if (!cur || o.effectivePrice < cur.effectivePrice) bySupplier.set(o.supplier.id, o);
  }
  const offers = [...bySupplier.values()]
    .sort((a, b) => a.effectivePrice - b.effectivePrice)
    .slice(0, 5);

  return {
    base: { name: base.name, unspscCode: base.unspscCode, unspscTitle: base.unspscTitle, category: base.category },
    offers,
    count: offers.length,
  };
}

module.exports = { search, facets, verifiedSuppliers, compareSuppliers };
