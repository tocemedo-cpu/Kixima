// tests/erp-doa-approval.test.js
// ERP DOA Approval (PRO): quando o comprador tem ERP real configurado, a
// aprovação e o pagamento da PO acontecem no ERP — não no KIXIMA. Cobre:
//   1. a PO só nasce erpManaged com PRO + ERP real configurado;
//   2. aprovar/rejeitar manualmente fica bloqueado nesse caso;
//   3. o callback assinado aplica a decisão/pagamento do ERP, idempotente;
//   4. HMAC inválido é recusado;
//   5. auditoria e notificação disparadas;
//   6. uma PO normal (não erpManaged) continua no fluxo de sempre.
process.env.KIXIMA_CALLBACK_SECRET = process.env.KIXIMA_CALLBACK_SECRET || 'segredo-teste-erp-doa';
process.env.ERP_CONFIG_ENCRYPTION_KEY = process.env.ERP_CONFIG_ENCRYPTION_KEY
  || require('crypto').randomBytes(32).toString('hex');

const crypto = require('crypto');
const { request, app, prisma, auth, loginAll } = require('./helpers');
const erpConfigService = require('../src/services/erpConfigService');

const SECRET = process.env.KIXIMA_CALLBACK_SECRET;
const PROOF = Buffer.from('%PDF-1.4 comprovativo de teste');

let tokens;
let compradora;
let planoOriginal;
let erpConfigOriginal;
let product;

function assinar(bodyObj) {
  const raw = JSON.stringify(bodyObj);
  const signature = crypto.createHmac('sha256', SECRET).update(raw).digest('hex');
  return { raw, signature };
}

async function callback(bodyObj, { signature } = {}) {
  const { raw, signature: sig } = assinar(bodyObj);
  return request(app)
    .post('/api/integration/callback')
    .set('Content-Type', 'application/json')
    .set('X-Kixima-Signature', signature !== undefined ? signature : sig)
    .send(raw);
}

beforeAll(async () => {
  tokens = await loginAll();
  compradora = await prisma.company.findFirst({ where: { type: 'CLIENTE' } });
  planoOriginal = { plan: compradora.plan, searchRank: compradora.searchRank };
  erpConfigOriginal = await prisma.companyErpConfig.findUnique({ where: { companyId: compradora.id } });

  const catalog = await auth(tokens.comprador).get('/api/catalog');
  product = catalog.body[0];
});

afterAll(async () => {
  await prisma.company.update({ where: { id: compradora.id }, data: planoOriginal });
  if (erpConfigOriginal) {
    await prisma.companyErpConfig.update({ where: { companyId: compradora.id }, data: erpConfigOriginal });
  } else {
    await prisma.companyErpConfig.deleteMany({ where: { companyId: compradora.id } });
  }
  await prisma.$disconnect();
});

async function configurarErpReal() {
  await prisma.company.update({ where: { id: compradora.id }, data: { plan: 'PRO', searchRank: 2 } });
  await erpConfigService.setConfig(
    compradora.id,
    { erp: 'SAP_S4HANA', config: { baseUrl: 'https://sap.teste.local', username: 'kixima', password: 'segredo' } },
    { actorId: null, actorName: 'teste' },
  );
}

async function desligarErp() {
  await erpConfigService.setConfig(compradora.id, { erp: 'MANUAL', config: {} }, { actorId: null, actorName: 'teste' });
}

async function criarPo() {
  const created = await auth(tokens.comprador)
    .post('/api/purchase-orders')
    .send({ supplierCompanyId: product.supplierId, items: [{ productId: product.id, quantity: 1 }] });
  expect(created.status).toBe(201);
  return created.body;
}

describe('Uma PO só nasce erpManaged com PRO + ERP real configurado', () => {
  test('PRO + ERP real (SAP) -> a PO nasce erpManaged, em AGUARDANDO_APROVACAO', async () => {
    await configurarErpReal();
    const po = await criarPo();
    expect(po.erpManaged).toBe(true);
    expect(po.status).toBe('AGUARDANDO_APROVACAO');
    expect(po.erpApprovalRequestedAt).toBeTruthy();

    const log = await prisma.erpSyncLog.findFirst({ where: { purchaseOrderId: po.id, eventType: 'approval_requested' } });
    expect(log).toBeTruthy();
    expect(log.direction).toBe('OUTBOUND');
  });

  test('PRO sem ERP (MANUAL) -> a PO nasce normal, não erpManaged', async () => {
    await prisma.company.update({ where: { id: compradora.id }, data: { plan: 'PRO', searchRank: 2 } });
    await desligarErp();
    const po = await criarPo();
    expect(po.erpManaged).toBe(false);
  });

  test('CORE (sem a feature erpIntegration), mesmo que houvesse ERP -> a PO nasce normal', async () => {
    await prisma.company.update({ where: { id: compradora.id }, data: { plan: 'CORE', searchRank: 1 } });
    const po = await criarPo();
    expect(po.erpManaged).toBe(false);
  });
});

describe('Aprovação/rejeição manual bloqueada numa PO erpManaged', () => {
  let po;
  beforeAll(async () => {
    await configurarErpReal();
    po = await criarPo();
    expect(po.erpManaged).toBe(true);
  });
  afterAll(async () => { await desligarErp(); });

  test('aprovar manualmente é recusado, com a mensagem certa', async () => {
    const res = await auth(tokens.companyAdmin).patch(`/api/purchase-orders/${po.id}/approve`);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/ERP configurado/);
    const ainda = await auth(tokens.companyAdmin).get(`/api/purchase-orders/${po.id}`);
    expect(ainda.body.status).toBe('AGUARDANDO_APROVACAO');
  });

  test('rejeitar manualmente é recusado', async () => {
    const res = await auth(tokens.companyAdmin)
      .patch(`/api/purchase-orders/${po.id}/reject`)
      .send({ reason: 'Preço acima do orçamento' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/ERP configurado/);
  });
});

describe('Callback assinado do ERP', () => {
  test('HMAC inválido é recusado (401), a PO não muda', async () => {
    await configurarErpReal();
    const po = await criarPo();

    const res = await callback(
      { type: 'purchase_order.approval_decided', data: { poId: po.id, aprovado: true } },
      { signature: 'assinatura-errada' },
    );
    expect(res.status).toBe(401);

    const ainda = await auth(tokens.companyAdmin).get(`/api/purchase-orders/${po.id}`);
    expect(ainda.body.status).toBe('AGUARDANDO_APROVACAO');
    await desligarErp();
  });

  test('decisão de aprovação aplica-se, com auditoria e notificação — e é idempotente', async () => {
    await configurarErpReal();
    const po = await criarPo();

    const res = await callback({
      type: 'purchase_order.approval_decided',
      data: { poId: po.id, aprovado: true, erpExternalId: 'SAP-DOA-00123' },
    });
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);

    const aprovada = await auth(tokens.companyAdmin).get(`/api/purchase-orders/${po.id}`);
    expect(aprovada.body.status).toBe('APROVADA');
    expect(aprovada.body.erpExternalId).toBe('SAP-DOA-00123');

    const auditoria = await prisma.auditLog.findFirst({ where: { entityType: 'PurchaseOrder', entityId: po.id, action: 'PO_APROVADA_ERP' } });
    expect(auditoria).toBeTruthy();
    expect(auditoria.actorName).toBe('ERP');

    const notificacao = await prisma.notification.findFirst({
      where: { relatedEntityType: 'PurchaseOrder', relatedEntityId: po.id, type: { in: ['PO_APROVADA', 'PO_REJEITADA'] } },
    });
    expect(notificacao).toBeTruthy();

    const syncLog = await prisma.erpSyncLog.findFirst({ where: { purchaseOrderId: po.id, eventType: 'approval_decided' } });
    expect(syncLog.direction).toBe('INBOUND');
    expect(syncLog.status).toBe('SUCCESS');

    // Repetir o MESMO callback (reenvio do ERP) não reaplica nem duplica auditoria.
    const outraVez = await callback({
      type: 'purchase_order.approval_decided',
      data: { poId: po.id, aprovado: true, erpExternalId: 'SAP-DOA-00123' },
    });
    expect(outraVez.status).toBe(200);
    const contagem = await prisma.auditLog.count({ where: { entityType: 'PurchaseOrder', entityId: po.id, action: 'PO_APROVADA_ERP' } });
    expect(contagem).toBe(1);

    await desligarErp();
  });

  test('decisão de rejeição aplica-se com o motivo', async () => {
    await configurarErpReal();
    const po = await criarPo();

    const res = await callback({
      type: 'purchase_order.approval_decided',
      data: { poId: po.id, aprovado: false, motivo: 'Excede o orçamento aprovado no ERP' },
    });
    expect(res.status).toBe(200);

    const rejeitada = await auth(tokens.companyAdmin).get(`/api/purchase-orders/${po.id}`);
    expect(rejeitada.body.status).toBe('REJEITADA');
    expect(rejeitada.body.rejectionReason).toMatch(/orçamento aprovado no ERP/);

    await desligarErp();
  });

  test('confirmação de pagamento avança a PO para PAGA, com recibo e taxa da plataforma', async () => {
    await configurarErpReal();
    const po = await criarPo();
    await callback({ type: 'purchase_order.approval_decided', data: { poId: po.id, aprovado: true } });
    await auth(tokens.fornecedor).patch(`/api/purchase-orders/${po.id}/accept`);

    const comFatura = await auth(tokens.companyAdmin).get(`/api/purchase-orders/${po.id}`);
    expect(comFatura.body.invoice).toBeTruthy();
    expect(comFatura.body.status).toBe('AGUARDANDO_PAGAMENTO');

    const res = await callback({
      type: 'payment.confirmed',
      data: { poId: po.id, erpExternalId: 'SAP-PAY-00456', valorPago: Number(comFatura.body.totalAmount) },
    });
    expect(res.status).toBe(200);

    const paga = await auth(tokens.companyAdmin).get(`/api/purchase-orders/${po.id}`);
    expect(paga.body.status).toBe('PAGA');
    expect(paga.body.invoice.status).toBe('PAGA');
    expect(paga.body.invoice.payment.canal).toBe('ERP');
    expect(paga.body.invoice.payment.amount).toBeTruthy();

    const taxa = await prisma.platformFee.findUnique({ where: { invoiceId: comFatura.body.invoice.id } });
    expect(taxa).toBeTruthy();

    // Idempotente: reenviar a confirmação de pagamento não cria um segundo Payment.
    await callback({ type: 'payment.confirmed', data: { poId: po.id, erpExternalId: 'SAP-PAY-00456' } });
    const pagamentos = await prisma.payment.count({ where: { invoiceId: comFatura.body.invoice.id } });
    expect(pagamentos).toBe(1);

    await desligarErp();
  });

  test('PO desconhecida: responde 200 (não deixa o ERP em retry-loop) e regista o motivo, sem lançar', async () => {
    const res = await callback({
      type: 'purchase_order.approval_decided',
      data: { poId: '00000000-0000-0000-0000-000000000000', aprovado: true },
    });
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    expect(res.body.error).toBeTruthy();
  });

  test('payload malformado (sem poId) é recusado com erro de negócio, sem rebentar', async () => {
    const res = await callback({ type: 'purchase_order.approval_decided', data: { aprovado: true } });
    expect(res.status).toBe(200);
    expect(res.body.error).toMatch(/poId/);
  });
});

describe('Uma PO normal (não erpManaged) continua no fluxo de sempre', () => {
  test('aprovação manual funciona como antes', async () => {
    await prisma.company.update({ where: { id: compradora.id }, data: { plan: 'PRO', searchRank: 2 } });
    await desligarErp();
    const po = await criarPo();
    expect(po.erpManaged).toBe(false);

    const res = await auth(tokens.companyAdmin).patch(`/api/purchase-orders/${po.id}/approve`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('APROVADA');
  });
});
