// tests/rbac.test.js
// Regras de acesso por persona (secção de segurança/RBAC).

const { auth, prisma, loginAll } = require('./helpers');

let tokens;
let product;

beforeAll(async () => {
  tokens = await loginAll();
  const catalog = await auth(tokens.comprador).get('/api/catalog');
  product = catalog.body[0];
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function poAguardandoAprovacao() {
  const res = await auth(tokens.comprador)
    .post('/api/purchase-orders')
    .send({ supplierCompanyId: product.supplierId, items: [{ productId: product.id, quantity: 1 }] });
  return res.body;
}

describe('RBAC — controlo de acessos por persona', () => {
  test('Comprador não pode aprovar uma PO (403)', async () => {
    const po = await poAguardandoAprovacao();
    const res = await auth(tokens.comprador).patch(`/api/purchase-orders/${po.id}/approve`);
    expect(res.status).toBe(403);
  });

  test('Fornecedor não pode aceder ao módulo de pagamentos (403)', async () => {
    const res = await auth(tokens.fornecedor).get('/api/payments/invoices/pending');
    expect(res.status).toBe(403);
  });

  test('Comprador não pode aceitar uma PO em nome do fornecedor (403)', async () => {
    const po = await poAguardandoAprovacao();
    await auth(tokens.companyAdmin).patch(`/api/purchase-orders/${po.id}/approve`);
    const res = await auth(tokens.comprador).patch(`/api/purchase-orders/${po.id}/accept`);
    expect(res.status).toBe(403);
  });

  test('Financeiro não pode emitir uma PO (403)', async () => {
    const res = await auth(tokens.financeiro)
      .post('/api/purchase-orders')
      .send({ supplierCompanyId: product.supplierId, items: [{ productId: product.id, quantity: 1 }] });
    expect(res.status).toBe(403);
  });
});
