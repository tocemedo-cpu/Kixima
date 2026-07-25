// tests/financeiro.test.js
// Telas do Financeiro (Centro Financeiro, Faturas, Pagamentos) — agregações de
// leitura das faturas da empresa.
const { auth, prisma, login } = require('./helpers');

let finToken, fornecedorToken;
beforeAll(async () => {
  finToken = await login('financeiro@petroangola.co.ao');
  fornecedorToken = await login('fornecedor@kianda.co.ao');
});
afterAll(async () => { await prisma.$disconnect(); });

describe('Financeiro — telas agregadas', () => {
  test('Centro Financeiro: KPIs, série 6 meses e faturas pendentes', async () => {
    const res = await auth(finToken).get('/api/financeiro/overview');
    expect(res.status).toBe(200);
    expect(res.body.kpis).toHaveProperty('pagamentosPendentes');
    expect(res.body.series.length).toBe(6);
    expect(Array.isArray(res.body.pendentes)).toBe(true);
  });

  test('Faturas: KPIs e itens com fornecedor', async () => {
    const res = await auth(finToken).get('/api/financeiro/invoices');
    expect(res.status).toBe(200);
    expect(res.body.kpis).toHaveProperty('pendentes');
    expect(res.body.items.every((i) => i.reference && i.supplier)).toBe(true);
  });

  test('Pagamentos: KPIs e todas as faturas', async () => {
    const res = await auth(finToken).get('/api/financeiro/payments');
    expect(res.status).toBe(200);
    expect(res.body.kpis).toHaveProperty('aPagar');
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  test('filtro por estado pago', async () => {
    const res = await auth(finToken).get('/api/financeiro/payments?status=PAGO');
    expect(res.status).toBe(200);
    expect(res.body.items.every((i) => i.status === 'PAGA')).toBe(true);
  });

  test('um fornecedor não acede às telas do Financeiro (403)', async () => {
    const res = await auth(fornecedorToken).get('/api/financeiro/overview');
    expect(res.status).toBe(403);
  });
});
