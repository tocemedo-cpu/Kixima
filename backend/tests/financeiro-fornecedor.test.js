// tests/financeiro-fornecedor.test.js
// Financeiro numa empresa FORNECEDORA: o mesmo perfil serve o lado de quem
// recebe — vê as ordens da empresa (lado fornecedor), confirma a receção do
// valor e o payload de sessão traz o companyType para o frontend adaptar as telas.
const { request, app, auth, prisma, loginAll, PASSWORD } = require('./helpers');
const authService = require('../src/services/authService');

const PROOF = Buffer.from('%PDF-1.4 comprovativo de teste');
const EMAIL = 'financeiro.forn.test@kianda.co.ao';

let tokens;
let product;
let supplierCompanyId;
let finFornToken;

beforeAll(async () => {
  tokens = await loginAll();
  const catalog = await auth(tokens.comprador).get('/api/catalog');
  product = catalog.body[0];
  supplierCompanyId = product.supplierId;

  // Cria um FINANCEIRO dentro da empresa fornecedora (Kianda).
  const passwordHash = await authService.hashPassword(PASSWORD);
  await prisma.user.upsert({
    where: { email: EMAIL },
    update: { active: true, companyId: supplierCompanyId, role: 'FINANCEIRO' },
    create: { name: 'Financeira Fornecedora', email: EMAIL, passwordHash, role: 'FINANCEIRO', companyId: supplierCompanyId },
  });
  const login = await request(app).post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });
  finFornToken = login.body.token;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

describe('Financeiro numa empresa fornecedora', () => {
  test('a sessão identifica o tipo da empresa (companyType=FORNECEDOR)', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.user.companyType).toBe('FORNECEDOR');
    const me = await auth(finFornToken).get('/api/auth/me');
    expect(me.body.user.companyType).toBe('FORNECEDOR');
  });

  test('vê as ordens da empresa do LADO FORNECEDOR e confirma a receção do valor', async () => {
    // Comprador → PO → aprovação → aceite → pagamento com comprovativo.
    const created = await auth(tokens.comprador)
      .post('/api/purchase-orders')
      .send({ supplierCompanyId, items: [{ productId: product.id, quantity: 1 }] });
    const po = created.body;
    await auth(tokens.companyAdmin).patch(`/api/purchase-orders/${po.id}/approve`);
    await auth(tokens.fornecedor).patch(`/api/purchase-orders/${po.id}/accept`);
    const full = await auth(tokens.financeiro).get(`/api/purchase-orders/${po.id}`);
    const paid = await auth(tokens.financeiro)
      .post(`/api/payments/invoices/${full.body.invoice.id}/pay`)
      .attach('proof', PROOF, 'comprovativo.pdf');
    expect(paid.status).toBe(201);

    // O Financeiro da fornecedora vê a ordem na lista da empresa…
    const list = await auth(finFornToken).get('/api/purchase-orders');
    expect(list.status).toBe(200);
    expect(list.body.some((o) => o.id === po.id)).toBe(true);

    // …e confirma a receção do valor (fecha o ciclo).
    const ok = await auth(finFornToken).patch(`/api/payments/${paid.body.id}/confirm-received`);
    expect(ok.status).toBe(200);
    expect(ok.body.receivedAt).toBeTruthy();
    expect(ok.body.receivedById).toBeTruthy();
  });

  test('o extrato da Taxa KIXIMA da própria empresa está acessível', async () => {
    const res = await auth(finFornToken).get(`/api/companies/${supplierCompanyId}/platform-fees`);
    expect(res.status).toBe(200);
    expect(res.body.company.id).toBe(supplierCompanyId);
  });

  test('continua SEM acesso às faturas a pagar de outras empresas (multi-tenant)', async () => {
    // O overview do lado comprador funciona mas é o da PRÓPRIA empresa (vazio de faturas a pagar,
    // porque a Kianda não compra); pagar faturas de outra empresa é vedado.
    const invoices = await auth(finFornToken).get('/api/payments/invoices/pending');
    expect(invoices.status).toBe(200);
    expect(invoices.body.every((i) => (i.purchaseOrder?.buyerCompanyId ?? i.contract?.clientCompanyId) === supplierCompanyId)).toBe(true);
  });
});
