// src/services/paymentService.js
// Passo 5 do fluxo: Financeiro valida e paga com fundos do cliente, dentro
// dos 7 dias. O Financeiro executa — não decide (a decisão já foi tomada
// pelo Company Admin no passo 2).

const { v4: uuid } = require('uuid');
const prisma = require('../config/database');
const { NotFoundError, ConflictError, ForbiddenError } = require('../utils/errors');
const notificationService = require('./notificationService');

async function listPendingInvoices(buyerCompanyId) {
  return prisma.invoice.findMany({
    where: {
      status: 'PENDENTE',
      OR: [
        { purchaseOrder: { buyerCompanyId } },
        { contract: { clientCompanyId: buyerCompanyId } },
      ],
    },
    include: { purchaseOrder: true, contract: true },
    orderBy: { dueAt: 'asc' },
  });
}

async function listPaymentHistory(buyerCompanyId) {
  return prisma.payment.findMany({
    where: {
      invoice: {
        OR: [
          { purchaseOrder: { buyerCompanyId } },
          { contract: { clientCompanyId: buyerCompanyId } },
        ],
      },
    },
    include: { invoice: { include: { purchaseOrder: true, contract: true } } },
    orderBy: { processedAt: 'desc' },
  });
}

async function processPayment(invoiceId, processedById, buyerCompanyId) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { purchaseOrder: true, contract: true },
  });
  if (!invoice) throw new NotFoundError('Fatura');
  if (invoice.status !== 'PENDENTE') {
    throw new ConflictError(`Fatura no estado "${invoice.status}" não pode ser paga.`);
  }

  const ownerCompanyId = invoice.purchaseOrder?.buyerCompanyId ?? invoice.contract?.clientCompanyId;
  if (ownerCompanyId !== buyerCompanyId) {
    throw new ForbiddenError('Só pode pagar faturas da sua própria empresa.');
  }

  const [payment] = await prisma.$transaction(async (tx) => {
    const createdPayment = await tx.payment.create({
      data: {
        invoiceId,
        amount: invoice.amount,
        currency: invoice.currency,
        processedById,
        reference: `PAY-${uuid().slice(0, 8).toUpperCase()}`,
        status: 'PROCESSADO',
      },
    });

    await tx.invoice.update({ where: { id: invoiceId }, data: { status: 'PAGA' } });

    if (invoice.purchaseOrderId) {
      await tx.purchaseOrder.update({
        where: { id: invoice.purchaseOrderId },
        data: { status: 'PAGA', paidAt: new Date() },
      });
    } else if (invoice.consolidatedPoIds?.length) {
      await tx.purchaseOrder.updateMany({
        where: { id: { in: invoice.consolidatedPoIds } },
        data: { paidAt: new Date() },
      });
    }

    return [createdPayment];
  });

  if (invoice.purchaseOrderId) {
    const po = await prisma.purchaseOrder.findUnique({ where: { id: invoice.purchaseOrderId } });
    await notificationService.events.pagamentoProcessado(payment, po);
  }

  return payment;
}

module.exports = { listPendingInvoices, listPaymentHistory, processPayment };
