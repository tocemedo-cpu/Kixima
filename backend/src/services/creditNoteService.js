// src/services/creditNoteService.js
// Nota de crédito — o mecanismo de CORREÇÃO fiscal de uma fatura já emitida.
//
// PORQUE NÃO SE CORRIGE A FATURA DIRETAMENTE. Uma fatura já emitida (com
// série, número e hash — ver faturacaoService.js) é imutável de propósito: um
// UPDATE ao valor, à data ou às linhas partiria a cadeia de integridade e
// tornaria a fatura original numa mentira sobre o que foi realmente cobrado.
// A nota de crédito é o documento que REGISTA a correção sem apagar o que
// aconteceu — sempre referenciando a fatura original, nunca um crédito solto
// sem rasto.
//
// O CRÉDITO NUNCA É ARBITRÁRIO. Não se aceita creditar mais do que a fatura
// ainda tem por creditar — duas notas de crédito parciais não podem, juntas,
// exceder o valor da fatura.
const prisma = require('../config/database');
const {
  NotFoundError, ForbiddenError, ValidationError, ConflictError,
} = require('../utils/errors');
const faturacaoService = require('./faturacaoService');
const taxService = require('./taxService');
const notificationService = require('./notificationService');
const auditService = require('./auditService');
const { nextReference } = require('../utils/reference');

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

async function carregarFatura(invoiceId) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      purchaseOrder: { select: { reference: true, buyerCompanyId: true, supplierCompanyId: true } },
      contract: { select: { reference: true, clientCompanyId: true, supplierCompanyId: true } },
    },
  });
  if (!invoice) throw new NotFoundError('Fatura');
  return invoice;
}

function partesDaFatura(invoice) {
  return {
    supplierCompanyId: invoice.purchaseOrder?.supplierCompanyId ?? invoice.contract?.supplierCompanyId,
    buyerCompanyId: invoice.purchaseOrder?.buyerCompanyId ?? invoice.contract?.clientCompanyId,
  };
}

/**
 * Soma de todas as notas de crédito já emitidas para esta fatura — o saldo
 * por creditar é `invoice.amount - totalCreditado`. Exportado para o gerador
 * SAF-T poder decidir se uma fatura está efetivamente anulada (ver
 * saftService.js) sem duplicar esta conta.
 */
async function totalCreditado(invoiceId) {
  const notas = await prisma.creditNote.findMany({ where: { invoiceId }, select: { amount: true } });
  return round2(notas.reduce((s, n) => s + Number(n.amount), 0));
}

/**
 * Emite uma nota de crédito contra uma fatura.
 *
 * `user` é quem pede — só o FORNECEDOR desta fatura (o emitente fiscal do
 * documento original) ou o ADMIN_SISTEMA (com a permissão FATURACAO, já
 * verificada na rota) podem corrigi-la. O comprador não emite notas de
 * crédito sobre faturas que recebe, tal como não emite as próprias faturas.
 */
async function emitir(invoiceId, { motivo, amount }, user, actor = null) {
  if (!motivo || !String(motivo).trim()) {
    throw new ValidationError('Indique o motivo da nota de crédito — uma correção fiscal sem motivo não se consegue explicar depois.');
  }
  const valor = Number(amount);
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new ValidationError('O valor da nota de crédito tem de ser um número positivo.');
  }

  const invoice = await carregarFatura(invoiceId);
  const { supplierCompanyId, buyerCompanyId } = partesDaFatura(invoice);

  if (user.role !== 'ADMIN_SISTEMA' && supplierCompanyId !== user.companyId) {
    throw new ForbiddenError('Só o fornecedor desta fatura pode pedir uma nota de crédito.');
  }

  const jaCreditado = await totalCreditado(invoiceId);
  const porCreditar = round2(Number(invoice.amount) - jaCreditado);
  if (valor > porCreditar) {
    throw new ConflictError(
      `Esta fatura já tem ${jaCreditado} ${invoice.currency} creditados. `
      + `Só pode creditar até ${porCreditar} ${invoice.currency} — o que pediu excede o saldo da fatura.`,
    );
  }

  // Net/imposto derivados proporcionalmente pela mesma taxa fixa que gerou a
  // fatura (ver taxService.js) — a nota de crédito reduz a mesma base, não
  // introduz uma taxa nova.
  const netAmount = round2(valor / (1 + taxService.IVA_RATE));
  const taxAmount = round2(valor - netAmount);

  const reference = await nextReference('NC', 'creditNote', 'reference');

  // A série da nota de crédito é a do MESMO fornecedor da fatura original
  // (sufixo "-NC" — ver faturacaoService.js), nunca uma série global.
  const supplierCompany = supplierCompanyId
    ? await prisma.company.findUnique({ where: { id: supplierCompanyId }, select: { serieFiscal: true } })
    : null;

  const nota = await prisma.$transaction(async (tx) => {
    const certificacao = await faturacaoService.atribuir(tx, {
      emitidaEm: new Date(),
      total: valor,
      codigo: faturacaoService.serieNotaCreditoDoFornecedor(supplierCompany),
    });

    const criada = await tx.creditNote.create({
      data: {
        ...certificacao,
        reference,
        invoiceId,
        motivo: String(motivo).trim(),
        amount: valor,
        netAmount,
        taxAmount,
        currency: invoice.currency,
        createdById: user.id || null,
      },
    });

    await auditService.record(tx, {
      actor: actor || { actorId: user.id, companyId: user.companyId },
      action: 'NOTA_CREDITO_EMITIDA',
      entityType: 'CreditNote',
      entityId: criada.id,
      entityRef: criada.reference,
      detail: {
        fatura: invoice.reference, motivo: String(motivo).trim(),
        valor: String(valor), moeda: invoice.currency,
      },
    });

    return criada;
  });

  if (buyerCompanyId) {
    notificationService.notifyUsersByRole({
      companyId: buyerCompanyId,
      roles: ['FINANCEIRO', 'COMPANY_ADMIN'],
      type: 'NOTA_CREDITO_EMITIDA',
      title: 'Nota de crédito emitida',
      message: `Nota de crédito ${nota.reference} de ${nota.amount} ${nota.currency}, referente à fatura ${invoice.reference}. Motivo: ${nota.motivo}`,
      channel: 'IN_APP_EMAIL',
      relatedEntityType: 'Invoice',
      relatedEntityId: invoice.id,
    }).catch(() => {});
  }

  return nota;
}

// Vê as notas de crédito de uma fatura quem é parte nela (comprador ou
// fornecedor) ou o ADMIN_SISTEMA — a mesma regra de posse de qualquer
// documento fiscal desta plataforma, nunca aberta a quem não tem nada a ver
// com a transação.
async function listar(invoiceId, user) {
  const invoice = await carregarFatura(invoiceId);
  if (user.role !== 'ADMIN_SISTEMA') {
    const { supplierCompanyId, buyerCompanyId } = partesDaFatura(invoice);
    if (![supplierCompanyId, buyerCompanyId].includes(user.companyId)) {
      throw new ForbiddenError('Só as partes desta fatura podem ver as suas notas de crédito.');
    }
  }
  return prisma.creditNote.findMany({ where: { invoiceId }, orderBy: { issuedAt: 'asc' } });
}

module.exports = { emitir, listar, totalCreditado, partesDaFatura, carregarFatura };
