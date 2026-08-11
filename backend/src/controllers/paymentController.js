const paymentService = require('../services/paymentService');
const auditService = require('../services/auditService');

async function pendingInvoices(req, res) {
  const invoices = await paymentService.listPendingInvoices(req.user.companyId);
  res.json(invoices);
}

async function history(req, res) {
  const payments = await paymentService.listPaymentHistory(req.user.companyId);
  res.json(payments);
}

async function pay(req, res) {
  // multipart: o comprovativo vem em req.file (campo "proof").
  const payment = await paymentService.processPayment(
    req.params.invoiceId, req.user.id, req.user.companyId, req.file, auditService.actorFrom(req),
  );
  res.status(201).json(payment);
}

// Fornecedor confirma que o valor entrou na conta.
async function confirmReceived(req, res) {
  const payment = await paymentService.confirmReceived(req.params.paymentId, req.user, auditService.actorFrom(req));
  res.json(payment);
}

module.exports = { pendingInvoices, history, pay, confirmReceived };
