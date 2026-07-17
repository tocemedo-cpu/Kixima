// src/services/contractService.js
// Contratos-quadro e Call-offs (secção 5 da especificação).

const prisma = require('../config/database');
const { NotFoundError, BusinessRuleError } = require('../utils/errors');
const { nextReference } = require('../utils/reference');

async function createContract({
  clientCompanyId,
  supplierCompanyId,
  categoriesCovered,
  totalValue,
  currency,
  billingPeriodicity,
  paymentTermDays,
  validFrom,
  validUntil,
}) {
  const reference = await nextReference('CTR', 'contract');
  return prisma.contract.create({
    data: {
      reference,
      clientCompanyId,
      supplierCompanyId,
      categoriesCovered,
      totalValue,
      currency,
      billingPeriodicity,
      paymentTermDays,
      validFrom,
      validUntil,
      status: 'ATIVO',
    },
  });
}

async function listContractsForCompany(companyId) {
  return prisma.contract.findMany({
    where: { OR: [{ clientCompanyId: companyId }, { supplierCompanyId: companyId }] },
    include: {
      clientCompany: { select: { id: true, name: true } },
      supplierCompany: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// Admin do Sistema KIXIMA não pertence a nenhuma empresa transacionadora
// (companyId: null), por isso vê todos os contratos-quadro da plataforma.
async function listAllContracts() {
  return prisma.contract.findMany({
    include: {
      clientCompany: { select: { id: true, name: true } },
      supplierCompany: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function getContract(id) {
  const contract = await prisma.contract.findUnique({
    where: { id },
    include: { callOffs: { orderBy: { createdAt: 'desc' } } },
  });
  if (!contract) throw new NotFoundError('Contrato');
  return contract;
}

/**
 * Deteção automática de Call-off: dado um comprador/cliente, fornecedor e as
 * categorias dos itens do checkout, procura um contrato-quadro ATIVO e válido
 * que cubra o fornecedor e todas as categorias. Usado por poService no
 * checkout — "no checkout, se o fornecedor selecionado tem contrato ativo
 * cobrindo o item/categoria, a PO vira Call-off sem o comprador precisar
 * fazer nada diferente."
 */
async function findActiveContractForOrder({ clientCompanyId, supplierCompanyId, categories }) {
  const now = new Date();
  const candidates = await prisma.contract.findMany({
    where: {
      clientCompanyId,
      supplierCompanyId,
      status: 'ATIVO',
      validFrom: { lte: now },
      validUntil: { gte: now },
    },
  });

  return candidates.find((contract) => categories.every((c) => contract.categoriesCovered.includes(c))) || null;
}

/**
 * Faturamento consolidado periódico: soma as call-offs "por faturar" de um
 * contrato e gera uma única fatura com o prazo de pagamento do contrato.
 */
async function consolidateContractBilling(contractId) {
  const contract = await prisma.contract.findUnique({ where: { id: contractId } });
  if (!contract) throw new NotFoundError('Contrato');

  const pendingCallOffs = await prisma.purchaseOrder.findMany({
    where: {
      contractId,
      isCallOff: true,
      status: { in: ['ENTREGUE', 'RECEBIDA_CONFORME', 'EM_EXECUCAO', 'APROVADA'] },
      invoice: null,
    },
  });

  if (pendingCallOffs.length === 0) {
    throw new BusinessRuleError('Não há call-offs pendentes de faturação para este contrato.');
  }

  const amount = pendingCallOffs.reduce((sum, po) => sum + Number(po.totalAmount), 0);
  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + contract.paymentTermDays);

  const reference = await nextReference('FAT', 'invoice');

  const invoice = await prisma.invoice.create({
    data: {
      reference,
      contractId,
      consolidatedPoIds: pendingCallOffs.map((po) => po.id),
      amount,
      currency: contract.currency,
      dueAt,
      status: 'PENDENTE',
    },
  });

  await prisma.purchaseOrder.updateMany({
    where: { id: { in: pendingCallOffs.map((po) => po.id) } },
    data: { paymentDueAt: dueAt },
  });

  const notificationService = require('./notificationService');
  await notificationService.notifyUsersByRole({
    companyId: contract.clientCompanyId,
    roles: ['FINANCEIRO'],
    type: 'FATURA_GERADA',
    title: 'Fatura consolidada de call-offs',
    message: `Fatura consolidada ${invoice.reference} gerada para o contrato ${contract.reference}, no valor de ${amount} ${contract.currency}.`,
    channel: 'IN_APP_EMAIL',
    relatedEntityType: 'Invoice',
    relatedEntityId: invoice.id,
  });

  return invoice;
}

module.exports = {
  createContract,
  listContractsForCompany,
  listAllContracts,
  getContract,
  findActiveContractForOrder,
  consolidateContractBilling,
};
