const poService = require('../services/poService');

async function create(req, res) {
  const po = await poService.createPurchaseOrder({
    buyerCompanyId: req.user.companyId,
    supplierCompanyId: req.body.supplierCompanyId,
    createdById: req.user.id,
    items: req.body.items,
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

async function approve(req, res) {
  const po = await poService.approvePurchaseOrder(req.params.id, req.user.id);
  res.json(po);
}

async function reject(req, res) {
  const po = await poService.rejectPurchaseOrder(req.params.id, req.user.id, req.body.reason);
  res.json(po);
}

async function accept(req, res) {
  const po = await poService.acceptPurchaseOrder(req.params.id, req.user.companyId);
  res.json(po);
}

async function refuse(req, res) {
  const po = await poService.refusePurchaseOrder(req.params.id, req.user.companyId);
  res.json(po);
}

async function dispatch(req, res) {
  const po = await poService.dispatchPurchaseOrder(req.params.id, req.user.companyId);
  res.json(po);
}

async function delivered(req, res) {
  const po = await poService.markDelivered(req.params.id, req.user.companyId);
  res.json(po);
}

async function receive(req, res) {
  const po = await poService.confirmReception(req.params.id, req.user.companyId, req.body);
  res.json(po);
}

module.exports = { create, list, getOne, approve, reject, accept, refuse, dispatch, delivered, receive };
