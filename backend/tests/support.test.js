// tests/support.test.js
// Ajuda & Suporte (overview + tickets) e foto de perfil (avatar).
const { auth, prisma, login } = require('./helpers');

let token, adminToken;
beforeAll(async () => {
  token = await login('comprador@petroangola.co.ao');
  adminToken = await login('admin@kixima.co.ao');
});
afterAll(async () => { await prisma.$disconnect(); });

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

describe('Ajuda & Suporte', () => {
  test('overview devolve categorias, canais e contagem de tickets abertos', async () => {
    const res = await auth(token).get('/api/support/overview');
    expect(res.status).toBe(200);
    expect(res.body.categories.length).toBeGreaterThan(0);
    expect(res.body.channels.length).toBeGreaterThan(0);
    expect(res.body.hours).toHaveProperty('label');
    expect(typeof res.body.openTickets).toBe('number');
  });

  test('lista os tickets do utilizador', async () => {
    const res = await auth(token).get('/api/support/tickets');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.every((t) => t.reference && t.status)).toBe(true);
  });

  test('cria um novo pedido de suporte', async () => {
    const res = await auth(token).post('/api/support/tickets').send({ subject: 'Teste', category: 'Geral', message: 'Mensagem de teste' });
    expect(res.status).toBe(201);
    expect(res.body.reference).toMatch(/^SUP-/);
    expect(res.body.status).toBe('ABERTO');
  });

  test('rejeita ticket sem assunto/mensagem (400)', async () => {
    const res = await auth(token).post('/api/support/tickets').send({ subject: '', message: '' });
    expect(res.status).toBe(400);
  });
});

describe('Perfil — foto', () => {
  test('GET /api/users/me inclui avatarUrl', async () => {
    const res = await auth(token).get('/api/users/me');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('avatarUrl');
    expect(res.body).toHaveProperty('email');
  });
});

describe('Ajuda & Suporte — imagens das categorias (Admin do Sistema)', () => {
  test('overview indica se o utilizador pode gerir imagens', async () => {
    const admin = await auth(adminToken).get('/api/support/overview');
    expect(admin.body.canManageImages).toBe(true);
    const comprador = await auth(token).get('/api/support/overview');
    expect(comprador.body.canManageImages).toBe(false);
  });

  test('o Admin do Sistema faz upload da imagem de uma categoria', async () => {
    const res = await auth(adminToken).post('/api/support/categories/ordens/image').attach('image', PNG, 'ordens.png');
    expect(res.status).toBe(200);
    expect(res.body.imageUrl).toBeTruthy();
    const ov = await auth(token).get('/api/support/overview');
    expect(ov.body.categories.find((c) => c.key === 'ordens').imageUrl).toBeTruthy();
  });

  test('um não-admin não pode trocar a imagem (403)', async () => {
    const res = await auth(token).post('/api/support/categories/ordens/image').attach('image', PNG, 'x.png');
    expect(res.status).toBe(403);
  });
});

describe('Ajuda & Suporte — painel do Administrador do Sistema', () => {
  test('admin vê KPIs e pedidos de toda a plataforma', async () => {
    const ov = await auth(adminToken).get('/api/support/admin/overview');
    expect(ov.status).toBe(200);
    expect(ov.body.kpis).toHaveProperty('total');
    const list = await auth(adminToken).get('/api/support/admin/tickets');
    expect(list.status).toBe(200);
    expect(list.body.length).toBeGreaterThan(0);
    // Inclui pedidos de mais de um utilizador (não só do admin).
    expect(new Set(list.body.map((t) => t.user?.email)).size).toBeGreaterThan(1);
  });

  test('admin altera o estado de um pedido', async () => {
    const list = await auth(adminToken).get('/api/support/admin/tickets');
    const id = list.body[0].id;
    const res = await auth(adminToken).patch(`/api/support/tickets/${id}`).send({ status: 'RESOLVIDO' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('RESOLVIDO');
  });

  test('um não-admin não acede ao painel de administração (403)', async () => {
    expect((await auth(token).get('/api/support/admin/overview')).status).toBe(403);
    expect((await auth(token).get('/api/support/admin/tickets')).status).toBe(403);
  });

  test('admin gere todos os locais de imagem (hero, atalhos, canais…)', async () => {
    const ov = await auth(adminToken).get('/api/support/admin/overview');
    expect(ov.body.imageSlots.length).toBeGreaterThanOrEqual(15);
    const groups = new Set(ov.body.imageSlots.map((s) => s.group));
    expect(groups.has('Destaque') && groups.has('Atalhos') && groups.has('Categorias') && groups.has('Canais')).toBe(true);
    // upload num slot não-categoria (ex.: hero)
    const up = await auth(adminToken).post('/api/support/images/hero').attach('image', PNG, 'hero.png');
    expect(up.status).toBe(200);
    const user = await auth(token).get('/api/support/overview');
    expect(user.body.images.hero).toBeTruthy();
    // slot inválido -> 404
    expect((await auth(adminToken).post('/api/support/images/inexistente').attach('image', PNG, 'x.png')).status).toBe(404);
  });
});
