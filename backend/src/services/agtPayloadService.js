// src/services/agtPayloadService.js
// Payload de submissão AGT (e-Fatura, schema v1.2) — FT (fatura), NC (nota de
// crédito) e RC (recibo/Payment). Uma estrutura única e reutilizável: os três
// tipos partilham `montarDocumentoComum` (envelope, assinatura, totais) e só
// diferem no que é mesmo específico de cada um — as linhas.
//
// SÓ LÊ. Não toca em nenhum fluxo de criação de documento — Invoice,
// CreditNote e Payment já recebem `serie`/`numeroNaSerie`/`hashDocumento`/
// `assinadaEm` em todos os pontos de criação (poService, creditNoteService,
// paymentService, conciliacaoService, todos via faturacaoService.atribuir()).
// Este serviço monta o payload a partir do que já está gravado.
//
// SÓ GERA E ASSINA — não submete a nenhum endpoint da AGT. Não existe
// URL/credenciais reais para isso (ver agtSigningService.js para a razão de
// nunca se fingir uma assinatura); quando existir contrato/certificação, a
// submissão em rede é uma camada nova por cima disto, não uma alteração ao
// que está aqui.
//
// FR (fatura-recibo) fica preparado no `documentType` mas sem produtor
// automático: o modelo de "pagamento garantido" do KIXIMA separa sempre a
// fatura (após aceite da PO) do recibo (após o pagamento confirmado) — nunca
// há um documento único que una os dois.
const crypto = require('crypto');
const prisma = require('../config/database');
const { NotFoundError, ForbiddenError, ValidationError } = require('../utils/errors');
const faturacaoService = require('./faturacaoService');
const creditNoteService = require('./creditNoteService');
const taxService = require('./taxService');
const agtSigningService = require('./agtSigningService');

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const SELECT_EMPRESA = { id: true, name: true, taxId: true, country: true };
const SELECT_PO = { supplierCompanyId: true, buyerCompanyId: true, buyerCompany: { select: SELECT_EMPRESA } };
const SELECT_CONTRATO = { supplierCompanyId: true, clientCompanyId: true, clientCompany: { select: SELECT_EMPRESA } };

// A AGT espera ISO-3166 (`"PT"` nas amostras); o KIXIMA guarda o país como
// texto livre (`Company.country`, "Angola" por omissão). Mapa pequeno para os
// casos conhecidos, com fallback para o valor tal como está (nunca inventa um
// código que não se sabe).
const PAIS_ISO = { Angola: 'AO', Portugal: 'PT' };
function paisISO(nome) {
  if (!nome) return 'AO';
  if (/^[A-Z]{2}$/.test(nome)) return nome;
  return PAIS_ISO[nome] || nome;
}

function withholdingListDe(valor) {
  const v = round2(valor || 0);
  if (v <= 0) return [];
  return [{ withholdingTaxType: 'IRT', withholdingTaxDescription: 'Retenção na fonte', withholdingTaxAmount: v }];
}

// `${tipo} ${numeroDocumentoAGT}` — reaproveita faturacaoService.numeroDocumentoAGT()
// tal como já existe; sem série certificada, cai na referência interna do
// KIXIMA (mesmo padrão que saftService.js já usa).
function numeroDocumento(tipo, doc) {
  const numero = faturacaoService.numeroDocumentoAGT({
    serie: doc.serie,
    ano: doc.assinadaEm ? new Date(doc.assinadaEm).getFullYear() : new Date().getFullYear(),
    numeroNaSerie: doc.numeroNaSerie,
  }) || doc.reference;
  return `${tipo} ${numero}`;
}

function clienteDe(documentoComPoOuContrato) {
  return documentoComPoOuContrato.purchaseOrder?.buyerCompany || documentoComPoOuContrato.contract?.clientCompany || null;
}

/**
 * Monta o objeto comum a FT/NC/RC dentro de `documents[]` — envelope de
 * campos e assinatura partilhados; só `lines`/`documentTotals`/
 * `withholdingTaxList` variam por tipo (recebidos já prontos).
 */
function montarDocumentoComum({ documentType, documentNo, dataDocumento, dataCriacao, taxRegistrationNumber, cliente, linhas, documentTotals, withholdingTaxList }) {
  const documentDate = new Date(dataDocumento || dataCriacao || Date.now()).toISOString().slice(0, 10);
  const systemEntryDate = new Date(dataCriacao || dataDocumento || Date.now()).toISOString();
  const customerTaxID = cliente?.taxId || 'DESCONHECIDO';
  const customerCountry = paisISO(cliente?.country);
  const companyName = cliente?.name || 'Desconhecido';

  return {
    documentNo,
    documentStatus: 'N',
    jwsDocumentSignature: agtSigningService.assinarDocumento({
      documentNo, taxRegistrationNumber, documentType, documentDate, customerTaxID, customerCountry, companyName,
    }),
    documentDate,
    documentType,
    systemEntryDate,
    customerTaxID,
    customerCountry,
    companyName,
    lines: linhas,
    paymentReceipt: null,
    documentTotals,
    withholdingTaxList,
  };
}

function documentoDeFatura(invoice, fornecedorTaxId) {
  const cliente = clienteDe(invoice);
  const linhas = invoice.lines.map((li) => ({
    lineNumber: li.lineNumber,
    productCode: li.productCode,
    productDescription: li.description,
    quantity: Number(li.quantity),
    unitOfMeasure: 'UN', // InvoiceLine não guarda unidade própria — ver Product.measurementUnit, sem relação direta aqui.
    unitPrice: Number(li.unitPrice),
    unitPriceBase: Number(li.unitPrice),
    debitAmount: 0,
    creditAmount: Number(li.netAmount),
    taxes: [{
      taxType: 'IVA', taxCountryRegion: 'AO', taxCode: li.ivaTaxCode,
      taxPercentage: round2(taxService.IVA_RATE * 100), taxContribution: Number(li.ivaAmount),
    }],
    settlementAmount: 0,
  }));

  return montarDocumentoComum({
    documentType: 'FT',
    documentNo: numeroDocumento('FT', invoice),
    dataDocumento: invoice.assinadaEm,
    dataCriacao: invoice.createdAt,
    taxRegistrationNumber: fornecedorTaxId,
    cliente,
    linhas,
    documentTotals: {
      taxPayable: Number(invoice.taxAmount || 0),
      netTotal: Number(invoice.netAmount || 0),
      grossTotal: Number(invoice.amount || 0),
    },
    withholdingTaxList: withholdingListDe(invoice.withholdingAmount),
  });
}

// NC não tem linhas no KIXIMA — CreditNote é uma correção por VALOR ÚNICO
// (decisão já tomada e documentada anteriormente). Para caber no schema da
// AGT, gera-se uma única linha sintética representando o valor total
// creditado, com `referenceInfo` a apontar para a fatura original.
function documentoDeNotaCredito(creditNote, fornecedorTaxId) {
  const invoice = creditNote.invoice;
  const cliente = clienteDe(invoice);
  const faturaOriginalNo = numeroDocumento('FT', invoice);
  const netAmount = Number(creditNote.netAmount || 0);

  const linhas = [{
    lineNumber: 1,
    productCode: 'CORRECAO',
    productDescription: creditNote.motivo,
    quantity: 1,
    unitOfMeasure: 'UN',
    unitPrice: netAmount,
    unitPriceBase: netAmount,
    referenceInfo: { reason: 'retificacao', reference: faturaOriginalNo, referenceItemLineNo: 1 },
    debitAmount: netAmount,
    creditAmount: 0,
    taxes: [{
      taxType: 'IVA', taxCountryRegion: 'AO', taxCode: faturacaoService.AGT_TAX_CODE_NORMAL,
      taxPercentage: round2(taxService.IVA_RATE * 100), taxContribution: Number(creditNote.taxAmount || 0),
    }],
    settlementAmount: 0,
  }];

  // Retenção proporcional ao peso da NC sobre a fatura original — a
  // CreditNote não guarda a sua própria retenção (não existe granularidade
  // por linha na correção por valor único).
  const invoiceNet = Number(invoice.netAmount || 0);
  const proporcao = invoiceNet > 0 ? netAmount / invoiceNet : 0;
  const retencao = proporcao * Number(invoice.withholdingAmount || 0);

  return montarDocumentoComum({
    documentType: 'NC',
    documentNo: numeroDocumento('NC', creditNote),
    dataDocumento: creditNote.assinadaEm || creditNote.issuedAt,
    dataCriacao: creditNote.createdAt,
    taxRegistrationNumber: fornecedorTaxId,
    cliente,
    linhas,
    documentTotals: {
      taxPayable: Number(creditNote.taxAmount || 0),
      netTotal: netAmount,
      grossTotal: Number(creditNote.amount || 0),
    },
    withholdingTaxList: withholdingListDe(retencao),
  });
}

// RC (recibo) quita uma fatura — sem linhas de produto próprias; os totais
// são os da fatura que liquida (o valor bruto é o efetivamente pago).
function documentoDeRecibo(payment, fornecedorTaxId) {
  const invoice = payment.invoice;
  const cliente = clienteDe(invoice);

  return montarDocumentoComum({
    documentType: 'RC',
    documentNo: numeroDocumento('RC', payment),
    dataDocumento: payment.assinadaEm,
    dataCriacao: payment.processedAt,
    taxRegistrationNumber: fornecedorTaxId,
    cliente,
    linhas: [],
    documentTotals: {
      taxPayable: Number(invoice.taxAmount || 0),
      netTotal: Number(invoice.netAmount || 0),
      grossTotal: Number(payment.amount || 0),
    },
    withholdingTaxList: withholdingListDe(invoice.withholdingAmount),
  });
}

function verificarPosse(donoId, supplierCompanyId) {
  if (!donoId || donoId !== supplierCompanyId) {
    throw new ForbiddenError('Este documento não pertence à empresa fornecedora indicada.');
  }
}

async function carregarFornecedor(supplierCompanyId) {
  const fornecedor = await prisma.company.findUnique({ where: { id: supplierCompanyId }, select: { id: true, taxId: true } });
  if (!fornecedor) throw new NotFoundError('Empresa fornecedora');
  return fornecedor;
}

function envelope(taxRegistrationNumber, documento) {
  return {
    schemaVersion: '1.2',
    submissionUUID: crypto.randomUUID(),
    taxRegistrationNumber,
    submissionTimeStamp: new Date().toISOString(),
    softwareInfo: agtSigningService.construirSoftwareInfo(taxRegistrationNumber),
    numberOfEntries: 1,
    documents: [documento],
  };
}

/**
 * Ponto de entrada único — a "estrutura única e reutilizável" pedida.
 * `tipo` ∈ 'FT' | 'NC' | 'RC'. Confirma que o documento pertence a
 * `supplierCompanyId` antes de assinar nada.
 */
async function construirPayload(tipo, id, supplierCompanyId) {
  agtSigningService.exigirConfiguracao();
  const fornecedor = await carregarFornecedor(supplierCompanyId);

  if (tipo === 'FT') {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        lines: { orderBy: { lineNumber: 'asc' } },
        purchaseOrder: { select: SELECT_PO },
        contract: { select: SELECT_CONTRATO },
      },
    });
    if (!invoice) throw new NotFoundError('Fatura');
    verificarPosse(creditNoteService.partesDaFatura(invoice).supplierCompanyId, supplierCompanyId);
    return envelope(fornecedor.taxId, documentoDeFatura(invoice, fornecedor.taxId));
  }

  if (tipo === 'NC') {
    const creditNote = await prisma.creditNote.findUnique({
      where: { id },
      include: {
        invoice: { include: { purchaseOrder: { select: SELECT_PO }, contract: { select: SELECT_CONTRATO } } },
      },
    });
    if (!creditNote) throw new NotFoundError('Nota de crédito');
    verificarPosse(creditNoteService.partesDaFatura(creditNote.invoice).supplierCompanyId, supplierCompanyId);
    return envelope(fornecedor.taxId, documentoDeNotaCredito(creditNote, fornecedor.taxId));
  }

  if (tipo === 'RC') {
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        invoice: { include: { purchaseOrder: { select: SELECT_PO }, contract: { select: SELECT_CONTRATO } } },
      },
    });
    if (!payment) throw new NotFoundError('Recibo');
    verificarPosse(creditNoteService.partesDaFatura(payment.invoice).supplierCompanyId, supplierCompanyId);
    return envelope(fornecedor.taxId, documentoDeRecibo(payment, fornecedor.taxId));
  }

  throw new ValidationError(
    `Tipo de documento "${tipo}" não suportado. Use FT, NC ou RC — FR não tem produtor automático no KIXIMA: `
    + 'a fatura e o recibo são sempre documentos separados no modelo de pagamento garantido.',
  );
}

module.exports = { construirPayload };
