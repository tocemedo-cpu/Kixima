// src/services/paymentService.js
// Passo 5 do fluxo: Financeiro valida e paga com fundos do cliente, dentro
// dos 7 dias. O Financeiro executa — não decide (a decisão já foi tomada
// pelo Company Admin no passo 2).

const { v4: uuid } = require('uuid');
const prisma = require('../config/database');
const { NotFoundError, ConflictError, ForbiddenError, ValidationError } = require('../utils/errors');
const notificationService = require('./notificationService');
const eventBus = require('./eventBus');
const platformFeeService = require('./platformFeeService');
const storageService = require('./storageService');
const auditService = require('./auditService');
const faturacaoService = require('./faturacaoService');
const agtSandboxSubmissionService = require('./agtSandboxSubmissionService');
const agtPayloadService = require('./agtPayloadService');
const logger = require('../config/logger');

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

async function processPayment(invoiceId, processedById, buyerCompanyId, proofFile = null, actor = null) {
  // Comprovativo da transferência OBRIGATÓRIO — é a prova (visível ao
  // fornecedor) de que o dinheiro saiu; sem ela o "pago" seria só uma palavra.
  if (!proofFile) {
    throw new ValidationError('Anexe o comprovativo da transferência (PDF ou imagem) para confirmar o pagamento.');
  }

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

  // Guarda o comprovativo antes da transação (upload não é transacional).
  const proofUrl = await storageService.saveFile({
    buffer: proofFile.buffer,
    originalname: proofFile.originalname,
    mimetype: proofFile.mimetype,
    keyHint: `comprovativo-${invoice.reference}`,
    folder: 'proofs',
  });

  // O pagamento É o documento "RC" (Recibo) da AGT — série e cadeia de
  // integridade próprias do MESMO fornecedor que emitiu a fatura (ver
  // faturacaoService.serieReciboDoFornecedor).
  const supplierCompanyId = invoice.purchaseOrder?.supplierCompanyId ?? invoice.contract?.supplierCompanyId;
  const supplierCompany = supplierCompanyId
    ? await prisma.company.findUnique({
      where: { id: supplierCompanyId },
      select: { serieFiscal: true, dataAdesaoFacturacaoElectronica: true },
    })
    : null;

  const [payment] = await prisma.$transaction(async (tx) => {
    const certificacao = await faturacaoService.atribuir(tx, {
      emitidaEm: new Date(),
      total: invoice.amount,
      codigo: faturacaoService.serieReciboDoFornecedor(supplierCompany),
      dataAdesao: supplierCompany?.dataAdesaoFacturacaoElectronica,
    });

    const createdPayment = await tx.payment.create({
      data: {
        ...certificacao,
        invoiceId,
        amount: invoice.amount,
        currency: invoice.currency,
        processedById,
        reference: `PAY-${uuid().slice(0, 8).toUpperCase()}`,
        status: 'PROCESSADO',
        proofUrl,
        proofName: proofFile.originalname || 'comprovativo',
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

    // Taxa da plataforma (KIXIMA) — à parte da PO/Fatura, cobrada ao fornecedor.
    const supplierCompanyId = invoice.purchaseOrder?.supplierCompanyId ?? invoice.contract?.supplierCompanyId;
    if (supplierCompanyId) {
      await platformFeeService.createForInvoice(tx, { invoice, companyId: supplierCompanyId });
    }

    // Auditoria DENTRO da transação: um pagamento sem registo não existe.
    await auditService.record(tx, {
      actor: actor || { actorId: processedById },
      action: 'PAGAMENTO_EXECUTADO',
      entityType: 'Payment',
      entityId: createdPayment.id,
      entityRef: createdPayment.reference,
      detail: {
        fatura: invoice.reference,
        valor: String(invoice.amount),
        moeda: invoice.currency,
        comprovativo: proofFile.originalname || 'comprovativo',
      },
    });

    return [createdPayment];
  });

  if (invoice.purchaseOrderId) {
    const po = await prisma.purchaseOrder.findUnique({ where: { id: invoice.purchaseOrderId } });
    await notificationService.events.pagamentoProcessado(payment, po);
  }

  // Evento para a integração ERP (pagamento concluído) — não-bloqueante.
  await eventBus.publish('payment.completed', eventBus.payloads.paymentCompleted(payment, invoice), {
    eventId: `payment-completed:${payment.id}`,
    tenantId: invoice.purchaseOrder?.buyerCompanyId ?? invoice.contract?.clientCompanyId ?? null,
  });

  // agtInvoiceResubmission — pedido explícito: ao confirmar o pagamento,
  // reenviar o FT desta fatura à AGT (registarFactura), com visibilidade do
  // payload e da resposta real (mesmo princípio de
  // agtSeriesService.solicitarSerie) — DIFERENTE da submissão RC acima
  // (agtSandboxSubmissionService, silenciosa, nunca lança). O FT já foi
  // submetido uma vez na emissão da fatura (poService.js/contractService.js)
  // — isto é um reenvio deliberado, não a primeira submissão; a AGT pode
  // recusá-lo por documentNo repetido, e é exatamente isso que se quer ver
  // aqui, não esconder. NUNCA bloqueia nem desfaz o pagamento já comitado
  // acima: o dinheiro já saiu, uma recusa de paperwork não desfaz isso.
  let agtInvoiceResubmission = null;
  if (supplierCompanyId) {
    try {
      const { payload, resposta, estado } = await agtPayloadService.submeterFatura(invoiceId, supplierCompanyId);
      agtInvoiceResubmission = { sucesso: true, payload, resposta, estado };
    } catch (erro) {
      agtInvoiceResubmission = {
        sucesso: false,
        erro: { message: erro.message, code: erro.code || null, details: erro.details || null },
      };
    }

    // Grava o resultado da ÚLTIMA tentativa na própria fatura — sem isto só
    // existia na resposta HTTP deste pedido, perdida depois. Numa falha de
    // escrita aqui (nunca esperada: a fatura já existe), só regista em log —
    // não pode desfazer nem falhar um pagamento já confirmado.
    try {
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: agtInvoiceResubmission.sucesso
          ? {
            agtRequestId: agtInvoiceResubmission.resposta?.requestID ?? null,
            agtResultCode: agtInvoiceResubmission.resposta?.resultCode != null ? String(agtInvoiceResubmission.resposta.resultCode) : null,
            agtErro: null,
            // Estado real do processamento (obterEstado), já consultado
            // automaticamente por submeterFatura() assim que há requestID —
            // sem isto só existia na resposta HTTP deste pedido.
            agtEstado: agtInvoiceResubmission.estado ?? null,
          }
          : {
            // A AGT pode atribuir requestID mesmo numa recusa (ex.:
            // `errorList` preenchida mas ainda assim com requestID) —
            // guarda-se sempre que vier, é o que permite consultar depois o
            // motivo real via obterEstado (agtPayloadService.consultarEstadoFatura).
            agtRequestId: agtInvoiceResubmission.erro?.details?.respostaBruta?.requestID ?? null,
            agtResultCode: agtInvoiceResubmission.erro?.details?.resultCode != null ? String(agtInvoiceResubmission.erro.details.resultCode) : null,
            agtErro: agtInvoiceResubmission.erro,
            agtEstado: agtInvoiceResubmission.erro?.details?.estado ?? null,
          },
      });
    } catch (erroGravar) {
      logger.error('Falha ao gravar o resultado do reenvio AGT na fatura', { invoiceId, message: erroGravar.message });
    }

    await agtSandboxSubmissionService.submeter('RC', payment.id, supplierCompanyId);
  }

  return { ...payment, agtInvoiceResubmission };
}

// O fornecedor confirma que o valor entrou na conta — fecha o ciclo de
// confiança do "pagamento garantido". Uma vez por pagamento.
async function confirmReceived(paymentId, user, actor = null) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { invoice: { include: { purchaseOrder: true, contract: true } } },
  });
  if (!payment) throw new NotFoundError('Pagamento');

  const supplierCompanyId =
    payment.invoice.purchaseOrder?.supplierCompanyId ?? payment.invoice.contract?.supplierCompanyId;
  if (supplierCompanyId !== user.companyId) {
    throw new ForbiddenError('Só o fornecedor desta fatura pode confirmar a receção.');
  }
  if (payment.receivedAt) {
    throw new ConflictError('A receção deste pagamento já foi confirmada.');
  }

  // Confirmação + auditoria na mesma transação (operação de dinheiro).
  const [updated] = await prisma.$transaction(async (tx) => {
    const upd = await tx.payment.update({
      where: { id: paymentId },
      data: { receivedAt: new Date(), receivedById: user.id },
    });
    await auditService.record(tx, {
      actor: actor || { actorId: user.id, companyId: user.companyId },
      action: 'RECECAO_VALOR_CONFIRMADA',
      entityType: 'Payment',
      entityId: payment.id,
      entityRef: payment.reference,
      detail: { fatura: payment.invoice.reference, valor: String(payment.amount), moeda: payment.currency },
    });
    return [upd];
  });
  return updated;
}

module.exports = { listPendingInvoices, listPaymentHistory, processPayment, confirmReceived };
