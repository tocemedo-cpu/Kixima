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
const eventBus = require('./eventBus');
const taxService = require('./taxService');
const faturacaoService = require('./faturacaoService');

// --- 1. Checkout: criação da PO ---------------------------------------------

async function createPurchaseOrder({ buyerCompanyId, supplierCompanyId, createdById, items }) {
  if (!items || items.length === 0) {
    throw new BusinessRuleError('A ordem de compra precisa de pelo menos um item.');
  }

  // Um comprador não pode comprar mercadorias da própria empresa.
  if (supplierCompanyId === buyerCompanyId) {
    throw new BusinessRuleError('Não pode comprar produtos da sua própria empresa.');
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
  // IVA no servidor, à imagem do que a fatura faz: o total da PO é o que o
  // comprador se compromete a pagar (com imposto). Sem isto a ordem mostrava um
  // valor e a fatura outro, e o limite de orçamento era consumido a menos.
  const impostos = taxService.summarize(
    lineItems.map((li) => ({ net: li.lineTotal, kind: products.find((p) => p.id === li.productId)?.kind })),
  );
  const totalAmount = impostos.gross;
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
      netAmount: impostos.net,
      taxAmount: impostos.tax,
      withholdingAmount: impostos.withheld,
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
      // O tecto do contrato-quadro é um valor COMERCIAL: consome-se com o
      // líquido, não com o IVA. Antes desta alteração o totalAmount já era o
      // líquido — manter o net preserva a semântica dos contratos em vigor.
      data: { usedValue: { increment: impostos.net } },
    });
    // Já aprovada -> segue diretamente para o fornecedor.
    await notificationService.events.poRecebidaPeloFornecedor(po);
  } else {
    await notificationService.events.poAguardaAprovacao(po);
  }

  return po;
}

const COMPANY_FIELDS = { select: { id: true, name: true, taxId: true, contactEmail: true, contactPhone: true, address: true, logoUrl: true, city: true, province: true, country: true, bankName: true, iban: true, swift: true } };

async function getPurchaseOrder(id, user = null) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      items: { include: { product: true } },
      invoice: { include: { payment: true } },
      buyerCompany: COMPANY_FIELDS,
      supplierCompany: COMPANY_FIELDS,
      createdBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      contract: { select: { reference: true } },
    },
  });
  if (!po) throw new NotFoundError('Ordem de compra');
  // Controlo de acesso multi-tenant: só as empresas envolvidas (ou o Admin do
  // Sistema) podem ver a PO. Devolve 404 para não revelar a existência.
  if (user && user.role !== 'ADMIN_SISTEMA') {
    const own = po.buyerCompanyId === user.companyId || po.supplierCompanyId === user.companyId;
    if (!own) throw new NotFoundError('Ordem de compra');
  }
  // Nome de quem processou o pagamento (Payment só guarda o id).
  if (po.invoice?.payment?.processedById) {
    const u = await prisma.user.findUnique({ where: { id: po.invoice.payment.processedById }, select: { name: true } });
    if (u) po.invoice.payment.processedByName = u.name;
  }
  return po;
}

async function listPurchaseOrders({ companyId, role, status, invoiced, page, limit }) {
  const where = { ...(status ? { status } : {}) };
  if (role === 'FORNECEDOR' || role === 'FINANCEIRO_FORNECEDOR') {
    where.supplierCompanyId = companyId;
  } else if (companyId) {
    where.OR = [{ buyerCompanyId: companyId }, { supplierCompanyId: companyId }];
  }
  // Só ordens que já têm fatura (ecrã de Faturas).
  if (invoiced) where.invoice = { isNot: null };

  const include = { items: true, invoice: { include: { payment: true } } };
  const orderBy = { createdAt: 'desc' };

  // Sem `page` → devolve o array completo (compatível com os consumidores
  // existentes). Com `page` → paginação server-side com envelope.
  if (!page) {
    return prisma.purchaseOrder.findMany({ where, include, orderBy });
  }
  const take = Math.min(Math.max(1, Number(limit) || 15), 50);
  const current = Math.max(1, Number(page));
  const [total, rows] = await Promise.all([
    prisma.purchaseOrder.count({ where }),
    prisma.purchaseOrder.findMany({ where, include, orderBy, skip: (current - 1) * take, take }),
  ]);
  return { items: rows, total, page: current, pages: Math.max(1, Math.ceil(total / take)), limit: take };
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

  // Evento para a integração ERP (não-bloqueante).
  await eventBus.publish('purchase_order.approved', eventBus.payloads.purchaseOrderApproved(po, updated.approvedAt), {
    eventId: `po-approved:${po.id}`,
    tenantId: po.buyerCompanyId,
  });
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
    // IVA (lei angolana): calculado por linha conforme o tipo do produto/serviço.
    const iva = taxService.summarize(po.items.map((li) => ({ net: Number(li.lineTotal), kind: li.product?.kind })));
    // Série, número e hash atribuídos DENTRO desta transação. Se o que vem a
    // seguir falhar, o número volta atrás com ela — é essa a diferença entre
    // uma numeração certificada e um contador qualquer.
    const certificacao = await faturacaoService.atribuir(tx, {
      emitidaEm: new Date(), total: iva.gross,
    });

    const createdInvoice = await tx.invoice.create({
      data: {
        ...certificacao,
        reference,
        purchaseOrderId: id,
        amount: iva.gross,               // total a pagar pelo comprador (com IVA)
        netAmount: iva.net,              // subtotal sem IVA
        taxAmount: iva.tax,              // IVA (14%)
        withholdingAmount: iva.withheld, // retenção na fonte II (6,5% serviços)
        currency: po.currency,
        dueAt: paymentDueAt,
        status: 'PENDENTE',
      },
    });

    return [updatedPo, createdInvoice];
  });

  await notificationService.events.faturaGerada(invoice, updated);

  // Evento para a integração ERP (não-bloqueante).
  await eventBus.publish('invoice.issued', eventBus.payloads.invoiceIssued(invoice, po), {
    eventId: `invoice-issued:${invoice.id}`,
    tenantId: po.buyerCompanyId,
  });
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

  // Evento para a integração ERP (receção de mercadoria) — não-bloqueante.
  await eventBus.publish('goods.received', eventBus.payloads.goodsReceived(po, updated.receivedAt), {
    eventId: `goods-received:${po.id}`,
    tenantId: po.buyerCompanyId,
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

// --- 7b. Resolução de divergências ------------------------------------------
// A divergência não pode ser um beco sem saída: o COMPRADOR fecha-a de uma de
// duas formas — ACEITE (aceita a entrega como está, ex.: após acordo/desconto
// negociado, → CONCLUIDA) ou REPOSICAO (o fornecedor corrige/reentrega,
// → EM_EXECUCAO, reabrindo o ciclo entrega→receção normal).

const DIVERGENCE_OUTCOMES = {
  ACEITE: { status: 'CONCLUIDA' },
  REPOSICAO: { status: 'EM_EXECUCAO' },
};

async function resolveDivergence(id, buyerCompanyId, { outcome, notes }) {
  const po = await getPurchaseOrder(id);
  if (po.buyerCompanyId !== buyerCompanyId) {
    throw new ForbiddenError('Só o comprador da PO pode resolver a divergência.');
  }
  if (po.status !== 'RECEBIDA_COM_DIVERGENCIA') {
    throw new ConflictError(`PO no estado "${po.status}" não tem divergência por resolver.`);
  }
  const target = DIVERGENCE_OUTCOMES[outcome];
  if (!target) {
    throw new BusinessRuleError('Desfecho inválido — use ACEITE ou REPOSICAO.');
  }

  const updated = await prisma.purchaseOrder.update({
    where: { id },
    data: {
      status: target.status,
      divergenceResolution: outcome,
      divergenceResolutionNotes: notes || null,
      divergenceResolvedAt: new Date(),
    },
  });

  await notificationService.events.divergenciaResolvida(updated);
  return updated;
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
  resolveDivergence,
};
