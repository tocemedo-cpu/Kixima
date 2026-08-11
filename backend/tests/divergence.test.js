// tests/divergence.test.js
// Resolução de divergências: a divergência deixa de ser um beco sem saída —
// o comprador aceita a entrega (→ CONCLUIDA) ou pede reposição (→ EM_EXECUCAO,
// reabrindo entrega→receção). Só o comprador da PO; fica registo e auditoria.
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

// Leva uma PO nova até RECEBIDA_COM_DIVERGENCIA. Devolve a PO.
async function poComDivergencia(notes = 'Quantidade incompleta') {
  const created = await auth(tokens.comprador)
    .post('/api/purchase-orders')
    .send({ supplierCompanyId: product.supplierId, items: [{ productId: product.id, quantity: 1 }] });
  const po = created.body;
  await auth(tokens.companyAdmin).patch(`/api/purchase-orders/${po.id}/approve`);
  await auth(tokens.fornecedor).patch(`/api/purchase-orders/${po.id}/accept`);
  const full = await auth(tokens.financeiro).get(`/api/purchase-orders/${po.id}`);
  await auth(tokens.financeiro)
    .post(`/api/payments/invoices/${full.body.invoice.id}/pay`)
    .attach('proof', PROOF, 'comprovativo.pdf');
  await auth(tokens.fornecedor).patch(`/api/purchase-orders/${po.id}/dispatch`);
  await auth(tokens.fornecedor).patch(`/api/purchase-orders/${po.id}/delivered`);
  const rec = await auth(tokens.comprador)
    .patch(`/api/purchase-orders/${po.id}/reception`)
    .send({ conforme: false, notes });
  expect(rec.body.status).toBe('RECEBIDA_COM_DIVERGENCIA');
  return po;
}

describe('Resolução de divergências', () => {
  test('ACEITE: comprador aceita a entrega e a ordem fica CONCLUIDA', async () => {
    const po = await poComDivergencia();
    const res = await auth(tokens.comprador)
      .patch(`/api/purchase-orders/${po.id}/resolve-divergence`)
      .send({ outcome: 'ACEITE', notes: 'Acordado desconto de 10% com o fornecedor' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CONCLUIDA');
    expect(res.body.divergenceResolution).toBe('ACEITE');
    expect(res.body.divergenceResolvedAt).toBeTruthy();

    // Auditoria com o desfecho.
    const log = await prisma.auditLog.findFirst({ where: { action: 'DIVERGENCIA_RESOLVIDA', entityId: po.id } });
    expect(log).toBeTruthy();
    expect(log.detail.desfecho).toBe('ACEITE');
  });

  test('REPOSICAO: reabre o ciclo — fornecedor reentrega e o comprador volta a rececionar', async () => {
    const po = await poComDivergencia('3 unidades danificadas');
    const res = await auth(tokens.comprador)
      .patch(`/api/purchase-orders/${po.id}/resolve-divergence`)
      .send({ outcome: 'REPOSICAO', notes: 'Repor as 3 unidades danificadas' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('EM_EXECUCAO');

    // O fornecedor foi notificado do pedido de reposição.
    const notif = await prisma.notification.findFirst({
      where: { type: 'DIVERGENCIA_RESOLVIDA', relatedEntityId: po.id, user: { companyId: product.supplierId } },
    });
    expect(notif).toBeTruthy();
    expect(notif.message).toMatch(/REPOSIÇÃO/i);

    // Ciclo reaberto: entregar de novo e rececionar conforme fecha a ordem.
    await auth(tokens.fornecedor).patch(`/api/purchase-orders/${po.id}/delivered`);
    const rec = await auth(tokens.comprador)
      .patch(`/api/purchase-orders/${po.id}/reception`)
      .send({ conforme: true });
    expect(rec.body.status).toBe('CONCLUIDA');
  });

  test('só o comprador da PO resolve — fornecedor e terceiros levam 403', async () => {
    const po = await poComDivergencia();
    const asSupplier = await auth(tokens.fornecedor)
      .patch(`/api/purchase-orders/${po.id}/resolve-divergence`)
      .send({ outcome: 'ACEITE' });
    expect(asSupplier.status).toBe(403);
  });

  test('sem divergência pendente não há nada para resolver (409)', async () => {
    const po = await poComDivergencia();
    await auth(tokens.comprador)
      .patch(`/api/purchase-orders/${po.id}/resolve-divergence`)
      .send({ outcome: 'ACEITE' });
    const again = await auth(tokens.comprador)
      .patch(`/api/purchase-orders/${po.id}/resolve-divergence`)
      .send({ outcome: 'REPOSICAO' });
    expect(again.status).toBe(409);
  });

  test('desfecho inválido é rejeitado (422)', async () => {
    const po = await poComDivergencia();
    const res = await auth(tokens.comprador)
      .patch(`/api/purchase-orders/${po.id}/resolve-divergence`)
      .send({ outcome: 'DEVOLVER' });
    expect(res.status).toBe(422);
  });
});
