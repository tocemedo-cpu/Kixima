// tests/fee-statement.test.js
// Extrato da Taxa KIXIMA por fornecedor: a própria empresa vê o que deve e
// porquê; o Admin do Sistema vê o de qualquer empresa; terceiros levam 403.
const { auth, prisma, loginAll } = require('./helpers');

const PROOF = Buffer.from('%PDF-1.4 comprovativo de teste');

let tokens;
let product;
let supplierCompanyId;

beforeAll(async () => {
  tokens = await loginAll();
  const catalog = await auth(tokens.comprador).get('/api/catalog');
  product = catalog.body[0];
  supplierCompanyId = product.supplierId;

  // Gera pelo menos uma taxa: PO paga (a taxa nasce na transação do pagamento).
  const created = await auth(tokens.comprador)
    .post('/api/purchase-orders')
    .send({ supplierCompanyId, items: [{ productId: product.id, quantity: 1 }] });
  await auth(tokens.companyAdmin).patch(`/api/purchase-orders/${created.body.id}/approve`);
  await auth(tokens.fornecedor).patch(`/api/purchase-orders/${created.body.id}/accept`);
  const full = await auth(tokens.financeiro).get(`/api/purchase-orders/${created.body.id}`);
  await auth(tokens.financeiro)
    .post(`/api/payments/invoices/${full.body.invoice.id}/pay`)
    .attach('proof', PROOF, 'comprovativo.pdf');
});
afterAll(async () => { await prisma.$disconnect(); });

describe('Extrato da Taxa KIXIMA', () => {
  test('o fornecedor vê o próprio extrato com fórmula e totais coerentes', async () => {
    const res = await auth(tokens.fornecedor).get(`/api/companies/${supplierCompanyId}/platform-fees`);
    expect(res.status).toBe(200);
    expect(res.body.company.id).toBe(supplierCompanyId);
    expect(res.body.fees.length).toBeGreaterThan(0);
    expect(res.body.formula.perPo).toBeGreaterThan(0);

    const { kpis, fees } = res.body;
    const soma = fees.reduce((s, f) => s + Number(f.amount), 0);
    expect(kpis.totalAOA).toBeCloseTo(soma, 2);
    expect(kpis.totalAOA).toBeCloseTo(kpis.pendingAOA + kpis.chargedAOA, 2);
    // Cada linha traz a fatura de origem e a composição.
    expect(fees[0].invoice.reference).toMatch(/^FAT-/);
    expect(Number(fees[0].amount)).toBeCloseTo(fees[0].poCount * Number(fees[0].perPo) + Number(fees[0].perInvoice), 2);
  });

  test('o Admin do Sistema vê o extrato de qualquer empresa', async () => {
    const res = await auth(tokens.adminSistema).get(`/api/companies/${supplierCompanyId}/platform-fees`);
    expect(res.status).toBe(200);
    expect(res.body.company.id).toBe(supplierCompanyId);
  });

  test('outra empresa NÃO vê o extrato alheio (403)', async () => {
    // O comprador (empresa PetroAngola) tenta ver o extrato do fornecedor Kianda.
    const res = await auth(tokens.companyAdmin).get(`/api/companies/${supplierCompanyId}/platform-fees`);
    expect(res.status).toBe(403);
  });
});
