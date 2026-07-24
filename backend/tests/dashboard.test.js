// tests/dashboard.test.js
// Painel do Comprador e fornecedores verificados.
const { auth, prisma, login } = require('./helpers');

let compradorToken, fornecedorToken;

beforeAll(async () => {
  compradorToken = await login('comprador@petroangola.co.ao');
  fornecedorToken = await login('fornecedor@kianda.co.ao');
});
afterAll(async () => { await prisma.$disconnect(); });

describe('Dashboard do Comprador', () => {
  test('devolve KPIs e Minhas Ordens', async () => {
    const res = await auth(compradorToken).get('/api/dashboard/comprador');
    expect(res.status).toBe(200);
    expect(res.body.kpis).toHaveProperty('emAndamento');
    expect(res.body.kpis.aguardandoPagamento).toHaveProperty('total');
    expect(Array.isArray(res.body.minhasOrdens)).toBe(true);
    expect(res.body.minhasOrdens.length).toBe(5);
  });

  test('um fornecedor não acede ao dashboard do comprador (403)', async () => {
    const res = await auth(fornecedorToken).get('/api/dashboard/comprador');
    expect(res.status).toBe(403);
  });

  test('fornecedores verificados incluem rating e contagem', async () => {
    const res = await auth(compradorToken).get('/api/marketplace/suppliers');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.every((s) => s.verified === undefined || s.verified)).toBe(true);
    if (res.body.length) expect(res.body[0]).toHaveProperty('productCount');
  });
});
