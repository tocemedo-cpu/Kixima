// src/services/poService.js
// Fluxo principal end-to-end (secção 3 da especificação):
//   1. Comprador monta cesta -> checkout -> PO emitida
//   2. Company Admin aprova a PO (ponto único de aprovação)
//   3. Fornecedor recebe e aceita a PO
//   4. Sistema gera fatura + começa o relógio dos 7 dias
//   5. Financeiro paga dentro dos 7 dias
//   6. Fornecedor só executa/despacha após pagamento confirmado
//   7. Comprador confirma receção
//   8. Sistema fecha a ordem
//
// Call-offs (contrato-quadro ativo) dispensam os passos 2 e 5 (aprovação e
// pagamento antecipado por PO) — ver contractService.

const prisma = require('../config/database');
const config = require('../config/env');
const { NotFoundError, BusinessRuleError, ForbiddenError, ConflictError } = require('../utils/errors');
const { nextReference } = require('../utils/reference');
const notificationService = require('./notificationService');
const contractService = require('./contractService');

// --- 1. Checkout: criação da PO ---------------------------------------------

async function createPurchaseOrder({ buyerCompanyId, supplierCompanyId, createdById, items }) {
  if (!items || items.length === 0) {
    throw new BusinessRuleError('A ordem de compra precisa de pelo menos um item.');
  }

  const productIds = items.map((i) => i.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  if (products.length !== productIds.length) {
    throw new NotFoundError('Um ou mais produtos');
  }
  const mismatched = products.some((p) => p.supplierId !== supplierCompanyId);
  if (mismatched) {
    throw new BusinessRuleError('Todos os itens da PO devem pertencer ao mesmo fornecedor.');
  }

  const lineItems = items.map((i) => {
    const product = products.find((p) => p.id === i.productId);
    const unitPrice = Number(product.unitPrice);
    return {
      productId: product.id,
      quantity: i.quantity,
      unitPrice,
      lineTotal: unitPrice * i.quantity,
    };
  });
  const totalAmount = lineItems.reduce((sum, li) => sum + li.lineTotal, 0);
  const categories = [...new Set(products.map((p) => p.category))];

  // Deteção automática de Call-off (secção 5)
  const contract = await contractService.findActiveContractForOrder({
    clientCompanyId: buyerCompanyId,
    supplierCompanyId,
    categories,
  });

  const reference = await nextReference('PO', 'purchaseOrder');
  const isCallOff = Boolean(contract);

  const po = await prisma.purchaseOrder.create({
    data: {
      reference,
      buyerCompanyId,
      supplierCompanyId,
      createdById,
      totalAmount,
      isCallOff,
      contractId: contract?.id ?? null,
      // Call-off: a aprovação de negócio já aconteceu na assinatura do contrato.
      status: isCallOff ? 'APROVADA' : 'AGUARDANDO_APROVACAO',
      approvedAt: isCallOff ? new Date() : null,
      items: { create: lineItems },
    },
    include: { items: true },
  });

  if (isCallOff) {
    await prisma.contract.update({
      where: { id: contract.id },
      data: { usedValue: { increment: totalAmount } },
    });
    // Já aprovada -> segue diretamente para o fornecedor.
    await notificationService.events.poRecebidaPeloFornecedor(po);
  } else {
    await notificationService.events.poAguardaAprovacao(po);
  }

  return po;
}

async function getPurchaseOrder(id) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { items: { include: { product: true } }, invoice: true },
  });
  if (!po) throw new NotFoundError('Ordem de compra');
  return po;
}

async function listPurchaseOrders({ companyId, role, status }) {
  const where = { ...(status ? { status } : {}) };
  if (role === 'FORNECEDOR' || role === 'FINANCEIRO_FORNECEDOR') {
    where.supplierCompanyId = companyId;
  } else if (companyId) {
    where.OR = [{ buyerCompanyId: companyId }, { supplierCompanyId: companyId }];
  }
  return prisma.purchaseOrder.findMany({
    where,
    include: { items: true, invoice: { include: { payment: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

// --- 2. Aprovação (Company Admin — ponto único) -----------------------------

async function approvePurchaseOrder(id, approverId) {
  const po = await getPurchaseOrder(id);
  if (po.isCallOff) {
    throw new BusinessRuleError('Call-offs não passam por aprovação individual.');
  }
  if (po.status !== 'AGUARDANDO_APROVACAO') {
    throw new ConflictError(`PO no estado "${po.status}" não pode ser aprovada.`);
  }

  const updated = await prisma.purchaseOrder.update({
    where: { id },
    data: { status: 'APROVADA', approvedById: approverId, approvedAt: new Date() },
  });

  await notificationService.events.poAprovadaOuRejeitada(updated);
  await notificationService.events.poRecebidaPeloFornecedor(updated);
  return updated;
}

async function rejectPurchaseOrder(id, approverId, reason) {
  const po = await getPurchaseOrder(id);
  if (po.isCallOff) {
    throw new BusinessRuleError('Call-offs não passam por aprovação individual.');
  }
  if (po.status !== 'AGUARDANDO_APROVACAO') {
    throw new ConflictError(`PO no estado "${po.status}" não pode ser rejeitada.`);
  }

  const updated = await prisma.purchaseOrder.update({
    where: { id },
    data: {
      status: 'REJEITADA',
      approvedById: approverId,
      rejectedAt: new Date(),
      rejectionReason: reason,
    },
  });

  await notificationService.events.poAprovadaOuRejeitada(updated);
  return updated;
}

// --- 3 & 4. Fornecedor aceita -> gera fatura + inicia relógio dos 7 dias ----

async function acceptPurchaseOrder(id, supplierCompanyId) {
  const po = await getPurchaseOrder(id);
  if (po.supplierCompanyId !== supplierCompanyId) {
    throw new ForbiddenError('Só o fornecedor da PO pode aceitá-la.');
  }
  if (po.status !== 'APROVADA') {
    throw new ConflictError(`PO no estado "${po.status}" não pode ser aceite.`);
  }

  const acceptedAt = new Date();

  if (po.isCallOff) {
    // Call-off: sem fatura individual nem prazo de 7 dias — a faturação é
    // consolidada periodicamente (ver contractService.consolidateContractBilling).
    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'EM_EXECUCAO', acceptedAt },
    });
    return updated;
  }

  const paymentDueAt = new Date(acceptedAt);
  paymentDueAt.setDate(paymentDueAt.getDate() + config.business.paymentSlaDays);

  const [updated, invoice] = await prisma.$transaction(async (tx) => {
    const updatedPo = await tx.purchaseOrder.update({
      where: { id },
      data: { status: 'ACEITE_FORNECEDOR', acceptedAt, paymentDueAt },
    });

    const reference = await nextReference('FAT', 'invoice');
    const createdInvoice = await tx.invoice.create({
      data: {
        reference,
        purchaseOrderId: id,
        amount: po.totalAmount,
        currency: po.currency,
        dueAt: paymentDueAt,
        status: 'PENDENTE',
      },
    });

    return [updatedPo, createdInvoice];
  });

  await notificationService.events.faturaGerada(invoice, updated);
  return updated;
}

async function refusePurchaseOrder(id, supplierCompanyId) {
  const po = await getPurchaseOrder(id);
  if (po.supplierCompanyId !== supplierCompanyId) {
    throw new ForbiddenError('Só o fornecedor da PO pode recusá-la.');
  }
  if (po.status !== 'APROVADA') {
    throw new ConflictError(`PO no estado "${po.status}" não pode ser recusada.`);
  }
  return prisma.purchaseOrder.update({ where: { id }, data: { status: 'RECUSADA_FORNECEDOR' } });
}

// --- 6. Execução/despacho (só após pagamento confirmado) --------------------

async function dispatchPurchaseOrder(id, supplierCompanyId) {
  const po = await getPurchaseOrder(id);
  if (po.supplierCompanyId !== supplierCompanyId) {
    throw new ForbiddenError('Só o fornecedor da PO pode despachar a entrega.');
  }

  const readyStatuses = po.isCallOff ? ['EM_EXECUCAO'] : ['PAGA'];
  if (!readyStatuses.includes(po.status)) {
    throw new BusinessRuleError(
      po.isCallOff
        ? 'Call-off precisa estar em execução antes do despacho.'
        : 'O pagamento precisa estar confirmado antes de despachar a entrega.'
    );
  }

  const updated = await prisma.purchaseOrder.update({
    where: { id },
    data: { status: 'EM_EXECUCAO', dispatchedAt: new Date() },
  });

  await notificationService.events.entregaDespachada(updated);
  return updated;
}

async function markDelivered(id, supplierCompanyId) {
  const po = await getPurchaseOrder(id);
  if (po.supplierCompanyId !== supplierCompanyId) {
    throw new ForbiddenError('Só o fornecedor da PO pode marcar como entregue.');
  }
  if (po.status !== 'EM_EXECUCAO') {
    throw new ConflictError(`PO no estado "${po.status}" não pode ser marcada como entregue.`);
  }
  return prisma.purchaseOrder.update({
    where: { id },
    data: { status: 'ENTREGUE', deliveredAt: new Date() },
  });
}

// --- 7. Receção (Comprador) --------------------------------------------------

async function confirmReception(id, buyerCompanyId, { conforme, notes }) {
  const po = await getPurchaseOrder(id);
  if (po.buyerCompanyId !== buyerCompanyId) {
    throw new ForbiddenError('Só o comprador da PO pode confirmar a receção.');
  }
  if (!['ENTREGUE', 'EM_EXECUCAO'].includes(po.status)) {
    throw new ConflictError(`PO no estado "${po.status}" não pode ter receção confirmada.`);
  }

  const receptionStatus = conforme ? 'Conforme' : notes || 'Com Divergência';
  const updated = await prisma.purchaseOrder.update({
    where: { id },
    data: {
      status: conforme ? 'RECEBIDA_CONFORME' : 'RECEBIDA_COM_DIVERGENCIA',
      receivedAt: new Date(),
      receptionStatus,
    },
  });

  if (!conforme) {
    await notificationService.events.rececaoComDivergencia(updated);
    return updated;
  }

  // 8. Sistema fecha a ordem automaticamente quando a receção é conforme.
  const concluida = await prisma.purchaseOrder.update({
    where: { id },
    data: { status: 'CONCLUIDA' },
  });
  return concluida;
}

module.exports = {
  createPurchaseOrder,
  getPurchaseOrder,
  listPurchaseOrders,
  approvePurchaseOrder,
  rejectPurchaseOrder,
  acceptPurchaseOrder,
  refusePurchaseOrder,
  dispatchPurchaseOrder,
  markDelivered,
  confirmReception,
};
