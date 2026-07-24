// tests/buyer.test.js
// Agregações de leitura das telas do Comprador (Ordens, Pagamentos, Entregas,
// Recepção, Fornecedores, Atividades, Perfil).
const { auth, prisma, login } = require('./helpers');

let compradorToken, fornecedorToken;

beforeAll(async () => {
  compradorToken = await login('comprador@petroangola.co.ao');
  fornecedorToken = await login('fornecedor@kianda.co.ao');
});
afterAll(async () => { await prisma.$disconnect(); });

describe('Comprador — telas agregadas', () => {
  test('Ordens: KPIs e lista com fornecedor e contagem de itens', async () => {
    const res = await auth(compradorToken).get('/api/buyer/orders');
    expect(res.status).toBe(200);
    expect(res.body.kpis.total).toBeGreaterThan(0);
    expect(res.body.items.length).toBeGreaterThan(0);
    const po = res.body.items[0];
    expect(po).toHaveProperty('reference');
    expect(po.supplier).toHaveProperty('name');
    expect(po).toHaveProperty('itemsCount');
  });

  test('Ordens: filtro por estado (canceladas)', async () => {
    const res = await auth(compradorToken).get('/api/buyer/orders?status=CANCELADAS');
    expect(res.status).toBe(200);
    expect(res.body.items.every((p) => ['REJEITADA', 'RECUSADA_FORNECEDOR'].includes(p.status))).toBe(true);
  });

  test('Pagamentos: KPIs financeiros e itens com estado', async () => {
    const res = await auth(compradorToken).get('/api/buyer/payments');
    expect(res.status).toBe(200);
    expect(res.body.kpis).toHaveProperty('aPagar');
    expect(res.body.items.every((r) => r.reference && r.status)).toBe(true);
  });

  test('Acompanhar Entrega: cada item tem estágio e progresso', async () => {
    const res = await auth(compradorToken).get('/api/buyer/deliveries');
    expect(res.status).toBe(200);
    expect(res.body.items.every((d) => typeof d.progress === 'number' && d.stage)).toBe(true);
  });

  test('Recepção: itens com estado de recepção', async () => {
    const res = await auth(compradorToken).get('/api/buyer/receptions');
    expect(res.status).toBe(200);
    expect(res.body.kpis).toHaveProperty('total');
    expect(res.body.items.every((r) => r.reference && r.status)).toBe(true);
  });

  test('Fornecedores: diretório com rating e estado', async () => {
    const res = await auth(compradorToken).get('/api/buyer/suppliers');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items[0]).toHaveProperty('rating');
    expect(res.body.kpis).toHaveProperty('homologados');
  });

  test('Atividades: tarefas derivadas do estado das POs', async () => {
    const res = await auth(compradorToken).get('/api/buyer/activities');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items.every((t) => t.title && t.status)).toBe(true);
  });

  test('Perfil: utilizador, empresa e resumo da conta', async () => {
    const res = await auth(compradorToken).get('/api/buyer/profile');
    expect(res.status).toBe(200);
    expect(res.body.user).toHaveProperty('email');
    expect(res.body.company).toHaveProperty('name');
    expect(res.body.summary).toHaveProperty('ordersYear');
  });

  test('um fornecedor não acede às telas do comprador (403)', async () => {
    const res = await auth(fornecedorToken).get('/api/buyer/orders');
    expect(res.status).toBe(403);
  });
});
