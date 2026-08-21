// src/services/contractService.js
// Contratos-quadro e Call-offs (secção 5 da especificação).

const prisma = require('../config/database');
const { NotFoundError, BusinessRuleError } = require('../utils/errors');
const { nextReference } = require('../utils/reference');
const taxService = require('./taxService');
const planService = require('./planService');
const faturacaoService = require('./faturacaoService');
const conciliacaoService = require('./conciliacaoService');

/**
 * O contrato-quadro está no plano Pro — mas de QUEM?
 *
 * Um contrato-quadro tem duas partes, e as duas beneficiam. A tentação é exigir
 * o plano às duas; seria errado. O contrato-quadro é um instrumento de COMPRA:
 * é a operadora que estabelece condições e depois emite call-offs contra elas.
 * Exigi-lo também ao fornecedor bloquearia uma operadora Pro de contratar um
 * fornecedor pequeno — e o marketplace perde mais com um catálogo estreito do
 * que ganha a empurrar fornecedores para cima de plano. É a mesma decisão que
 * já está tomada na ordenação da pesquisa, e pelo mesmo motivo.
 *
 * A guarda vale também quando é o Admin do Sistema a criar: a regra é sobre o
 * que o plano do cliente inclui, não sobre quem carregou no botão. Sem isso, a
 * via de administração passa a ser a porta por onde a funcionalidade paga se
 * oferece de graça, sem ninguém reparar.
 */
async function exigirPlanoParaContrato(clientCompanyId) {
  const cliente = await prisma.company.findUnique({ where: { id: clientCompanyId } });
  if (!cliente) throw new NotFoundError('Empresa cliente');
  planService.assertFeature(cliente, 'frameworkContracts', 'Contratos-quadro');
}

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
  await exigirPlanoParaContrato(clientCompanyId);

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

async function getContract(id, user = null) {
  const contract = await prisma.contract.findUnique({
    where: { id },
    include: { callOffs: { orderBy: { createdAt: 'desc' } } },
  });
  if (!contract) throw new NotFoundError('Contrato');
  // Controlo de acesso multi-tenant: só as empresas do contrato (ou o Admin do
  // Sistema) podem vê-lo. Devolve 404 para não revelar a existência.
  if (user && user.role !== 'ADMIN_SISTEMA') {
    const own = contract.clientCompanyId === user.companyId || contract.supplierCompanyId === user.companyId;
    if (!own) throw new NotFoundError('Contrato');
  }
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
    include: { items: { include: { product: { select: { kind: true } } } } },
  });

  if (pendingCallOffs.length === 0) {
    throw new BusinessRuleError('Não há call-offs pendentes de faturação para este contrato.');
  }

  // IVA (lei angolana) por linha de todos os call-offs consolidados.
  const iva = taxService.summarize(
    pendingCallOffs.flatMap((po) => po.items.map((li) => ({ net: Number(li.lineTotal), kind: li.product?.kind }))),
  );
  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + contract.paymentTermDays);

  const reference = await nextReference('FAT', 'invoice');

  // A série certificada é do FORNECEDOR (emitente fiscal desta fatura), nunca
  // uma série global da KIXIMA — ver faturacaoService.js.
  const supplierCompany = await prisma.company.findUnique({
    where: { id: contract.supplierCompanyId }, select: { serieFiscal: true },
  });

  // A fatura e a atualização das call-offs passam a viver na MESMA transação.
  //
  // Antes eram duas escritas soltas, e isso já era frágil: uma falha entre as
  // duas deixava uma fatura emitida sem as ordens correspondentes marcadas. Com
  // numeração certificada deixa de ser aceitável de todo — o número da série é
  // atribuído aqui dentro, e só uma transação o devolve se algo correr mal.
  const invoice = await prisma.$transaction(async (tx) => {
    const certificacao = await faturacaoService.atribuir(tx, {
      emitidaEm: new Date(), total: iva.gross,
      codigo: faturacaoService.serieFiscalDoFornecedor(supplierCompany),
    });

    const criada = await tx.invoice.create({
      data: {
        ...certificacao,
        reference,
        contractId,
        consolidatedPoIds: pendingCallOffs.map((po) => po.id),
        amount: iva.gross,
        netAmount: iva.net,
        taxAmount: iva.tax,
        withholdingAmount: iva.withheld,
        currency: contract.currency,
        dueAt,
        status: 'PENDENTE',
      },
    });

    await tx.purchaseOrder.updateMany({
      where: { id: { in: pendingCallOffs.map((po) => po.id) } },
      data: { paymentDueAt: dueAt },
    });

    await conciliacaoService.atribuirReferencia(criada.id, tx);
    return tx.invoice.findUnique({ where: { id: criada.id } });
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
