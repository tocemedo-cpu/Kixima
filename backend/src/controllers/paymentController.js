const paymentService = require('../services/paymentService');
const creditNoteService = require('../services/creditNoteService');
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

// Fornecedor (ou ADMIN_SISTEMA) pede uma nota de crédito sobre uma fatura já
// emitida — o mecanismo de correção fiscal (ver creditNoteService.js).
async function emitirNotaCredito(req, res) {
  const nota = await creditNoteService.emitir(
    req.params.invoiceId,
    { motivo: req.body?.motivo, amount: req.body?.amount },
    req.user,
    auditService.actorFrom(req),
  );
  res.status(201).json(nota);
}

async function listarNotasCredito(req, res) {
  res.json(await creditNoteService.listar(req.params.invoiceId, req.user));
}

module.exports = {
  pendingInvoices, history, pay, confirmReceived, emitirNotaCredito, listarNotasCredito,
};
