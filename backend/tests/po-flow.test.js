// tests/po-flow.test.js
// Fluxo principal end-to-end da Purchase Order (secção 3 da especificação) e as
// regras de negócio críticas: fatura + relógio dos 7 dias na aceitação, despacho
// só após pagamento, e fecho automático (CONCLUIDA) na receção conforme.

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

// Cria uma PO nova (não call-off) e devolve o corpo.
async function novaPO() {
  const res = await auth(tokens.comprador)
    .post('/api/purchase-orders')
    .send({
      supplierCompanyId: product.supplierId,
      items: [{ productId: product.id, quantity: 2 }],
    });
  expect(res.status).toBeLessThan(300);
  return res.body;
}

describe('Fluxo principal da Purchase Order', () => {
  test('percorre todos os estados até CONCLUIDA', async () => {
    // 1. Comprador emite a PO
    const po = await novaPO();
    expect(po.status).toBe('AGUARDANDO_APROVACAO');
    expect(po.isCallOff).toBe(false);
    expect(po.reference).toMatch(/^PO-\d{4}-\d{6}$/);

    // 2. Company Admin aprova (ponto único de aprovação)
    const approved = await auth(tokens.companyAdmin).patch(`/api/purchase-orders/${po.id}/approve`);
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe('APROVADA');

    // 3. Fornecedor aceita -> 4. gera fatura + relógio dos 7 dias
    const accepted = await auth(tokens.fornecedor).patch(`/api/purchase-orders/${po.id}/accept`);
    expect(accepted.status).toBe(200);
    expect(accepted.body.status).toBe('ACEITE_FORNECEDOR');

    const full = await auth(tokens.financeiro).get(`/api/purchase-orders/${po.id}`);
    const invoice = full.body.invoice;
    expect(invoice).toBeTruthy();
    expect(invoice.reference).toMatch(/^FAT-\d{4}-\d{6}$/);

    // Prazo de pagamento = data de emissão + 7 dias (PAYMENT_SLA_DAYS)
    const issued = new Date(invoice.issuedAt);
    const due = new Date(invoice.dueAt);
    const diffDays = Math.round((due - issued) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(7);

    // 5. Financeiro paga
    const paid = await auth(tokens.financeiro)
      .post(`/api/payments/invoices/${invoice.id}/pay`)
      .send({ method: 'TRANSFERENCIA' });
    expect(paid.status).toBeLessThan(300);

    // 6. Fornecedor despacha e marca entregue
    const dispatched = await auth(tokens.fornecedor).patch(`/api/purchase-orders/${po.id}/dispatch`);
    expect(dispatched.status).toBe(200);
    expect(dispatched.body.status).toBe('EM_EXECUCAO');

    const delivered = await auth(tokens.fornecedor).patch(`/api/purchase-orders/${po.id}/delivered`);
    expect(delivered.status).toBe(200);
    expect(delivered.body.status).toBe('ENTREGUE');

    // 7/8. Comprador confirma receção conforme -> fecho automático
    const received = await auth(tokens.comprador)
      .patch(`/api/purchase-orders/${po.id}/reception`)
      .send({ conforme: true });
    expect(received.status).toBe(200);
    // Regressão: a resposta tem de refletir o estado final CONCLUIDA, não o
    // intermédio RECEBIDA_CONFORME.
    expect(received.body.status).toBe('CONCLUIDA');

    // E a base de dados confirma o mesmo.
    const dbPo = await prisma.purchaseOrder.findUnique({ where: { id: po.id } });
    expect(dbPo.status).toBe('CONCLUIDA');
  });

  test('despacho antes do pagamento é bloqueado', async () => {
    const po = await novaPO();
    await auth(tokens.companyAdmin).patch(`/api/purchase-orders/${po.id}/approve`);
    await auth(tokens.fornecedor).patch(`/api/purchase-orders/${po.id}/accept`);

    // Sem pagamento, o despacho tem de falhar.
    const dispatched = await auth(tokens.fornecedor).patch(`/api/purchase-orders/${po.id}/dispatch`);
    expect(dispatched.status).toBeGreaterThanOrEqual(400);

    // O estado não avançou.
    const dbPo = await prisma.purchaseOrder.findUnique({ where: { id: po.id } });
    expect(dbPo.status).toBe('ACEITE_FORNECEDOR');
  });

  test('receção com divergência não fecha a ordem', async () => {
    const po = await novaPO();
    await auth(tokens.companyAdmin).patch(`/api/purchase-orders/${po.id}/approve`);
    await auth(tokens.fornecedor).patch(`/api/purchase-orders/${po.id}/accept`);
    const full = await auth(tokens.financeiro).get(`/api/purchase-orders/${po.id}`);
    await auth(tokens.financeiro)
      .post(`/api/payments/invoices/${full.body.invoice.id}/pay`)
      .send({ method: 'TRANSFERENCIA' });
    await auth(tokens.fornecedor).patch(`/api/purchase-orders/${po.id}/dispatch`);
    await auth(tokens.fornecedor).patch(`/api/purchase-orders/${po.id}/delivered`);

    const received = await auth(tokens.comprador)
      .patch(`/api/purchase-orders/${po.id}/reception`)
      .send({ conforme: false, notes: 'Quantidade recebida a menos' });
    expect(received.status).toBe(200);
    expect(received.body.status).toBe('RECEBIDA_COM_DIVERGENCIA');
  });
});
