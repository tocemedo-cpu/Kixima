// tests/payment-proof.test.js
// Comprovativo de pagamento: obrigatório ao pagar, visível ao fornecedor, e
// confirmação de receção do valor pelo fornecedor (uso único).
const { auth, prisma, loginAll } = require('./helpers');

const PROOF = Buffer.from('%PDF-1.4 comprovativo de teste');

let tokens;
let product;

beforeAll(async () => {
  tokens = await loginAll();
  const catalog = await auth(tokens.comprador).get('/api/catalog');
  product = catalog.body[0];
});
afterAll(async () => { await prisma.$disconnect(); });

// Leva uma PO nova até ter fatura pendente; devolve { po, invoice }.
async function novaFatura() {
  const created = await auth(tokens.comprador)
    .post('/api/purchase-orders')
    .send({ supplierCompanyId: product.supplierId, items: [{ productId: product.id, quantity: 1 }] });
  const po = created.body;
  await auth(tokens.companyAdmin).patch(`/api/purchase-orders/${po.id}/approve`);
  await auth(tokens.fornecedor).patch(`/api/purchase-orders/${po.id}/accept`);
  const full = await auth(tokens.financeiro).get(`/api/purchase-orders/${po.id}`);
  return { po, invoice: full.body.invoice };
}

describe('Comprovativo de pagamento', () => {
  test('pagar SEM comprovativo é rejeitado (422) e a fatura continua pendente', async () => {
    const { invoice } = await novaFatura();
    const res = await auth(tokens.financeiro).post(`/api/payments/invoices/${invoice.id}/pay`).send({});
    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/comprovativo/i);
    const db = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    expect(db.status).toBe('PENDENTE');
  });

  test('pagar COM comprovativo grava o ficheiro e os metadados', async () => {
    const { invoice } = await novaFatura();
    const res = await auth(tokens.financeiro)
      .post(`/api/payments/invoices/${invoice.id}/pay`)
      .attach('proof', PROOF, 'transferencia-bai.pdf');
    expect(res.status).toBe(201);
    expect(res.body.proofUrl).toBeTruthy();
    expect(res.body.proofName).toBe('transferencia-bai.pdf');
    expect(res.body.receivedAt).toBeNull();
  });

  test('o fornecedor vê o comprovativo e confirma a receção (uma única vez)', async () => {
    const { po, invoice } = await novaFatura();
    await auth(tokens.financeiro)
      .post(`/api/payments/invoices/${invoice.id}/pay`)
      .attach('proof', PROOF, 'comprovativo.pdf');

    // O fornecedor vê o pagamento com o comprovativo na sua lista de ordens.
    const full = await auth(tokens.fornecedor).get(`/api/purchase-orders/${po.id}`);
    const payment = full.body.invoice.payment;
    expect(payment.proofUrl).toBeTruthy();

    // Confirma a receção do valor.
    const ok = await auth(tokens.fornecedor).patch(`/api/payments/${payment.id}/confirm-received`);
    expect(ok.status).toBe(200);
    expect(ok.body.receivedAt).toBeTruthy();

    // Segunda confirmação é rejeitada (409).
    const again = await auth(tokens.fornecedor).patch(`/api/payments/${payment.id}/confirm-received`);
    expect(again.status).toBe(409);
  });

  test('quem não é o fornecedor da fatura NÃO confirma a receção', async () => {
    const { invoice } = await novaFatura();
    const paid = await auth(tokens.financeiro)
      .post(`/api/payments/invoices/${invoice.id}/pay`)
      .attach('proof', PROOF, 'comprovativo.pdf');

    // O Financeiro do COMPRADOR passa no perfil da rota mas falha na empresa (403).
    const res = await auth(tokens.financeiro).patch(`/api/payments/${paid.body.id}/confirm-received`);
    expect(res.status).toBe(403);
    // O comprador nem passa no perfil da rota (403).
    const res2 = await auth(tokens.comprador).patch(`/api/payments/${paid.body.id}/confirm-received`);
    expect(res2.status).toBe(403);
  });
});
