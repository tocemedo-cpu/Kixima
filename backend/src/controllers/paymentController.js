const paymentService = require('../services/paymentService');

async function pendingInvoices(req, res) {
  const invoices = await paymentService.listPendingInvoices(req.user.companyId);
  res.json(invoices);
}

async function history(req, res) {
  const payments = await paymentService.listPaymentHistory(req.user.companyId);
  res.json(payments);
}

async function pay(req, res) {
  const payment = await paymentService.processPayment(req.params.invoiceId, req.user.id, req.user.companyId);
  res.status(201).json(payment);
}

module.exports = { pendingInvoices, history, pay };
