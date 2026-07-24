// tests/support.test.js
// Ajuda & Suporte (overview + tickets) e foto de perfil (avatar).
const { auth, prisma, login } = require('./helpers');

let token;
beforeAll(async () => { token = await login('comprador@petroangola.co.ao'); });
afterAll(async () => { await prisma.$disconnect(); });

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
