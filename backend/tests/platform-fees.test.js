// tests/platform-fees.test.js
// A) Dados bancários da empresa (Fornecedor preenche/edita; entram na fatura).
// B) Taxa KIXIMA (platform_fees) — gerada no pagamento, à parte da fatura,
//    cobrada ao fornecedor; livro consultável pelo Admin do Sistema.
const { auth, prisma, loginAll } = require('./helpers');
const platformFeeService = require('../src/services/platformFeeService');

let tokens;
let product;

beforeAll(async () => {
  tokens = await loginAll();
  const catalog = await auth(tokens.comprador).get('/api/catalog');
  product = catalog.body[0];
});

afterAll(async () => { await prisma.$disconnect(); });

// Leva uma PO nova até estar paga e devolve { po, invoice }.
async function pagaPO() {
  const created = await auth(tokens.comprador)
    .post('/api/purchase-orders')
    .send({ supplierCompanyId: product.supplierId, items: [{ productId: product.id, quantity: 2 }] });
  const po = created.body;
  await auth(tokens.companyAdmin).patch(`/api/purchase-orders/${po.id}/approve`);
  await auth(tokens.fornecedor).patch(`/api/purchase-orders/${po.id}/accept`);
  const full = await auth(tokens.financeiro).get(`/api/purchase-orders/${po.id}`);
  const invoice = full.body.invoice;
  const paid = await auth(tokens.financeiro)
    .post(`/api/payments/invoices/${invoice.id}/pay`)
    .attach('proof', Buffer.from('%PDF-1.4 comprovativo de teste'), 'comprovativo.pdf');
  expect(paid.status).toBeLessThan(300);
  return { po, invoice };
}

describe('A) Dados bancários da empresa', () => {
  test('o Fornecedor grava e lê os dados bancários da sua empresa', async () => {
    const me = await auth(tokens.fornecedor).get('/api/auth/me');
    const companyId = me.body.companyId || me.body.user?.companyId;

    const put = await auth(tokens.fornecedor)
      .put(`/api/companies/${companyId}/bank-details`)
      .send({ bankName: 'Banco Teste', iban: 'ao06 0000 1111 2222', swift: 'bteste ' });
    expect(put.status).toBe(200);
    // Normaliza IBAN/SWIFT (sem espaços, maiúsculas).
    expect(put.body.iban).toBe('AO0600001111 2222'.replace(/\s+/g, ''));
    expect(put.body.swift).toBe('BTESTE');

    const get = await auth(tokens.fornecedor).get(`/api/companies/${companyId}/bank-details`);
    expect(get.status).toBe(200);
    expect(get.body.bankName).toBe('Banco Teste');
  });

  test('uma empresa não acede aos dados bancários de outra (403)', async () => {
    const otherCompany = await prisma.company.findFirst({ where: { type: 'CLIENTE' } });
    const res = await auth(tokens.fornecedor).get(`/api/companies/${otherCompany.id}/bank-details`);
    expect(res.status).toBe(403);
  });
});

describe('B) Taxa KIXIMA (platform_fees)', () => {
  test('compute: (nº POs × PER_PO) + PER_INVOICE', () => {
    const f = platformFeeService.compute(3);
    expect(f.amount).toBe(3 * platformFeeService.PER_PO + platformFeeService.PER_INVOICE);
    expect(f.currency).toBe('AOA');
  });

  test('o pagamento gera uma taxa para o fornecedor, à parte da fatura', async () => {
    const supplier = await prisma.company.findFirst({ where: { type: 'FORNECEDOR' } });
    const { invoice } = await pagaPO();

    const fee = await prisma.platformFee.findUnique({ where: { invoiceId: invoice.id } });
    expect(fee).toBeTruthy();
    expect(fee.companyId).toBe(supplier.id);
    expect(fee.status).toBe('PENDENTE');
    expect(Number(fee.amount)).toBe(platformFeeService.PER_PO + platformFeeService.PER_INVOICE);
    // A taxa não altera o valor da fatura nem do pagamento.
    const payment = await prisma.payment.findUnique({ where: { invoiceId: invoice.id } });
    expect(Number(payment.amount)).toBe(Number(invoice.amount));
  });

  test('o Admin do Sistema vê o livro de taxas e pode marcar como cobrada', async () => {
    await pagaPO();
    const list = await auth(tokens.adminSistema).get('/api/admin/platform-fees');
    expect(list.status).toBe(200);
    expect(list.body.kpis.total).toBeGreaterThan(0);
    expect(list.body.fees.length).toBeGreaterThan(0);

    const pendente = list.body.fees.find((f) => f.status === 'PENDENTE');
    const charged = await auth(tokens.adminSistema).patch(`/api/admin/platform-fees/${pendente.id}/charge`);
    expect(charged.status).toBe(200);
    expect(charged.body.status).toBe('COBRADO');
    expect(charged.body.chargedAt).toBeTruthy();
  });

  test('um não-admin não acede ao livro de taxas (403)', async () => {
    const res = await auth(tokens.fornecedor).get('/api/admin/platform-fees');
    expect(res.status).toBe(403);
  });
});
