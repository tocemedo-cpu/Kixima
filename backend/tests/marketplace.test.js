// tests/marketplace.test.js
// Pesquisa do marketplace (paginação/filtros/ordenação), favoritos e avaliações.
const { auth, prisma, login } = require('./helpers');

let compradorToken, fornecedorToken;
let favProductId;

beforeAll(async () => {
  compradorToken = await login('comprador@petroangola.co.ao');
  fornecedorToken = await login('fornecedor@kianda.co.ao');
});

afterAll(async () => {
  const comprador = await prisma.user.findUnique({ where: { email: 'comprador@petroangola.co.ao' } });
  await prisma.favorite.deleteMany({ where: { userId: comprador.id } });
  await prisma.review.deleteMany({ where: { userId: comprador.id } });
  await prisma.$disconnect();
});

describe('Marketplace — pesquisa e paginação', () => {
  test('paginação devolve estrutura {items,total,page,pages,limit}', async () => {
    const res = await auth(compradorToken).get('/api/marketplace/search?limit=2&page=1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('pages');
    expect(res.body.limit).toBe(2);
    expect(res.body.items.length).toBeLessThanOrEqual(2);
  });

  test('filtro kind=SERVICO devolve apenas serviços', async () => {
    const res = await auth(compradorToken).get('/api/marketplace/search?kind=SERVICO&limit=48');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items.every((p) => p.kind === 'SERVICO')).toBe(true);
    favProductId = res.body.items[0].id;
  });

  test('pesquisa por texto (q) filtra por nome/descrição', async () => {
    const res = await auth(compradorToken).get('/api/marketplace/search?q=ultrassom');
    expect(res.status).toBe(200);
    expect(res.body.items.some((p) => /ultrassom/i.test(p.name))).toBe(true);
  });

  test('ordenação por menor preço', async () => {
    const res = await auth(compradorToken).get('/api/marketplace/search?sort=preco_asc&limit=48');
    const prices = res.body.items.map((p) => Number(p.unitPrice));
    const sorted = [...prices].sort((a, b) => a - b);
    expect(prices).toEqual(sorted);
  });

  test('facetas devolvem contagem por categoria', async () => {
    const res = await auth(compradorToken).get('/api/marketplace/facets?kind=SERVICO');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.categories)).toBe(true);
    expect(res.body.categories[0]).toHaveProperty('count');
  });

  test('facetas devolvem tipos, localizações e certificações', async () => {
    const res = await auth(compradorToken).get('/api/marketplace/facets');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.kinds)).toBe(true);
    expect(res.body.kinds.some((k) => k.name === 'SERVICO' || k.name === 'PRODUTO')).toBe(true);
    expect(res.body.kinds[0]).toHaveProperty('count');
    expect(Array.isArray(res.body.countries)).toBe(true);
    expect(res.body.countries.every((c) => c.name)).toBe(true);
    expect(Array.isArray(res.body.certifications)).toBe(true);
  });

  test('comprador não vê produtos da própria empresa', async () => {
    const comprador = await prisma.user.findUnique({ where: { email: 'comprador@petroangola.co.ao' } });
    const res = await auth(compradorToken).get('/api/marketplace/search?limit=48');
    expect(res.body.items.every((p) => p.supplierId !== comprador.companyId)).toBe(true);
  });
});

describe('Favoritos', () => {
  test('adicionar, listar e remover favorito', async () => {
    const add = await auth(compradorToken).post('/api/marketplace/favorites').send({ productId: favProductId });
    expect(add.status).toBe(201);
    const list = await auth(compradorToken).get('/api/marketplace/favorites');
    expect(list.body).toContain(favProductId);
    // aparece como isFavorite na pesquisa
    const search = await auth(compradorToken).get('/api/marketplace/search?kind=SERVICO&limit=48');
    expect(search.body.items.find((p) => p.id === favProductId).isFavorite).toBe(true);
    const del = await auth(compradorToken).del(`/api/marketplace/favorites/${favProductId}`);
    expect(del.status).toBe(200);
    const list2 = await auth(compradorToken).get('/api/marketplace/favorites');
    expect(list2.body).not.toContain(favProductId);
  });
});

describe('Pesquisas guardadas', () => {
  test('guardar, listar e remover uma pesquisa', async () => {
    const create = await auth(compradorToken).post('/api/marketplace/saved-searches')
      .send({ label: '"inspeção"', query: 'q=inspeção&kind=SERVICO' });
    expect(create.status).toBe(201);
    expect(create.body).toHaveProperty('id');
    expect(create.body.label).toBe('"inspeção"');

    const list = await auth(compradorToken).get('/api/marketplace/saved-searches');
    expect(list.status).toBe(200);
    expect(list.body.some((s) => s.id === create.body.id)).toBe(true);

    const del = await auth(compradorToken).del(`/api/marketplace/saved-searches/${create.body.id}`);
    expect(del.status).toBe(200);
    const list2 = await auth(compradorToken).get('/api/marketplace/saved-searches');
    expect(list2.body.some((s) => s.id === create.body.id)).toBe(false);
  });

  test('cada utilizador só vê as suas pesquisas guardadas', async () => {
    const mine = await auth(compradorToken).post('/api/marketplace/saved-searches')
      .send({ label: 'só minha', query: 'q=x' });
    const others = await auth(fornecedorToken).get('/api/marketplace/saved-searches');
    expect(others.body.some((s) => s.id === mine.body.id)).toBe(false);
    await auth(compradorToken).del(`/api/marketplace/saved-searches/${mine.body.id}`);
  });
});

describe('Avaliações', () => {
  test('comprador avalia e a média é recalculada', async () => {
    const res = await auth(compradorToken).post(`/api/catalog/${favProductId}/reviews`).send({ rating: 5, comment: 'Excelente serviço' });
    expect(res.status).toBe(201);
    expect(res.body.reviewCount).toBeGreaterThanOrEqual(1);
    const prod = await prisma.product.findUnique({ where: { id: favProductId } });
    expect(prod.rating).toBeGreaterThan(0);
  });

  test('um fornecedor não pode avaliar (403)', async () => {
    const res = await auth(fornecedorToken).post(`/api/catalog/${favProductId}/reviews`).send({ rating: 4 });
    expect(res.status).toBe(403);
  });
});
