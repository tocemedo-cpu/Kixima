const poService = require('../services/poService');
const auditService = require('../services/auditService');

async function create(req, res) {
  const po = await poService.createPurchaseOrder({
    buyerCompanyId: req.user.companyId,
    supplierCompanyId: req.body.supplierCompanyId,
    createdById: req.user.id,
    items: req.body.items,
  });
  await auditService.recordSafe({
    actor: auditService.actorFrom(req),
    action: 'PO_CRIADA',
    entityType: 'PurchaseOrder',
    entityId: po.id,
    entityRef: po.reference,
    detail: { valor: String(po.totalAmount), moeda: po.currency, fornecedor: po.supplierCompanyId },
  });
  res.status(201).json(po);
}

async function list(req, res) {
  const orders = await poService.listPurchaseOrders({
    companyId: req.user.companyId,
    role: req.user.role,
    status: req.query.status,
    invoiced: req.query.invoiced === 'true',
    page: req.query.page,
    limit: req.query.limit,
  });
  res.json(orders);
}

async function getOne(req, res) {
  const po = await poService.getPurchaseOrder(req.params.id, req.user);
  res.json(po);
}

async function history(req, res) {
  const events = await poService.getPurchaseOrderHistory(req.params.id, req.user);
  res.json(events);
}

async function approve(req, res) {
  const po = await poService.approvePurchaseOrder(req.params.id, req.user.id);
  await auditService.recordSafe({
    actor: auditService.actorFrom(req),
    action: 'PO_APROVADA',
    entityType: 'PurchaseOrder',
    entityId: po.id,
    entityRef: po.reference,
    detail: { valor: String(po.totalAmount), moeda: po.currency },
  });
  res.json(po);
}

async function reject(req, res) {
  const po = await poService.rejectPurchaseOrder(req.params.id, req.user.id, req.body.reason);
  await auditService.recordSafe({
    actor: auditService.actorFrom(req),
    action: 'PO_REJEITADA',
    entityType: 'PurchaseOrder',
    entityId: po.id,
    entityRef: po.reference,
    detail: { motivo: req.body.reason || null },
  });
  res.json(po);
}

async function accept(req, res) {
  const po = await poService.acceptPurchaseOrder(req.params.id, req.user.companyId);
  await auditService.recordSafe({
    actor: auditService.actorFrom(req),
    action: 'PO_ACEITE',
    entityType: 'PurchaseOrder',
    entityId: po.id,
    entityRef: po.reference,
    detail: { valor: String(po.totalAmount), moeda: po.currency },
  });
  res.json(po);
}

async function refuse(req, res) {
  const po = await poService.refusePurchaseOrder(req.params.id, req.user.companyId, req.body.reason);
  await auditService.recordSafe({
    actor: auditService.actorFrom(req),
    action: 'PO_RECUSADA_FORNECEDOR',
    entityType: 'PurchaseOrder',
    entityId: po.id,
    entityRef: po.reference,
    detail: { motivo: req.body.reason },
  });
  res.json(po);
}

async function dispatch(req, res) {
  const po = await poService.dispatchPurchaseOrder(req.params.id, req.user.companyId);
  await auditService.recordSafe({
    actor: auditService.actorFrom(req),
    action: 'PO_DESPACHADA',
    entityType: 'PurchaseOrder',
    entityId: po.id,
    entityRef: po.reference,
  });
  res.json(po);
}

async function delivered(req, res) {
  const po = await poService.markDelivered(req.params.id, req.user.companyId);
  await auditService.recordSafe({
    actor: auditService.actorFrom(req),
    action: 'PO_ENTREGUE',
    entityType: 'PurchaseOrder',
    entityId: po.id,
    entityRef: po.reference,
  });
  res.json(po);
}

// Comprador fecha a divergência: aceita a entrega (→ CONCLUIDA) ou pede
// reposição ao fornecedor (→ EM_EXECUCAO, reabre entrega→receção).
async function resolveDivergence(req, res) {
  const po = await poService.resolveDivergence(req.params.id, req.user.companyId, req.body);
  await auditService.recordSafe({
    actor: auditService.actorFrom(req),
    action: 'DIVERGENCIA_RESOLVIDA',
    entityType: 'PurchaseOrder',
    entityId: po.id,
    entityRef: po.reference,
    detail: { desfecho: req.body.outcome, notas: req.body.notes || null },
  });
  res.json(po);
}

async function receive(req, res) {
  const po = await poService.confirmReception(req.params.id, req.user.companyId, req.body);
  await auditService.recordSafe({
    actor: auditService.actorFrom(req),
    action: 'RECECAO_MERCADORIA',
    entityType: 'PurchaseOrder',
    entityId: po.id,
    entityRef: po.reference,
    detail: { conforme: Boolean(req.body.conforme), notas: req.body.notes || null },
  });
  // Receção conforme fecha a ordem automaticamente (poService.confirmReception)
  // — fica marcado como um evento próprio na linha do tempo, distinto da
  // receção em si.
  if (po.status === 'CONCLUIDA') {
    await auditService.recordSafe({
      actor: auditService.actorFrom(req),
      action: 'PO_CONCLUIDA',
      entityType: 'PurchaseOrder',
      entityId: po.id,
      entityRef: po.reference,
      detail: { motivo: 'receção conforme' },
    });
  }
  res.json(po);
}

module.exports = { create, list, getOne, history, approve, reject, accept, refuse, dispatch, delivered, receive, resolveDivergence };
