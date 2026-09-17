// src/services/agtPayloadService.js
// Payload de submissão AGT (e-Fatura, schema v2.0) — FT (fatura), NC (nota de
// crédito) e RC (recibo/Payment). Uma estrutura única e reutilizável: os três
// tipos partilham `montarDocumentoComum` (envelope, assinatura, totais) e só
// diferem no que é mesmo específico de cada um — as linhas.
//
// NÃO TOCA no fluxo de criação/certificação interna do documento — Invoice,
// CreditNote e Payment já recebem `serie`/`numeroNaSerie`/`hashDocumento`/
// `assinadaEm` em todos os pontos de criação (poService, creditNoteService,
// paymentService, conciliacaoService, todos via faturacaoService.atribuir()).
// A ÚNICA escrita feita por este serviço é `agtDocumentNo` — atribuído uma
// única vez por agtSeriesService.atribuirDocumentNo() (ver numeroDocumento()
// abaixo), na primeira vez que o payload deste documento é construído.
//
// construirPayload() SÓ GERA E ASSINA — não submete a nada, é o que a rota
// GET /agt-payload/:tipo/:id devolve. submeterFatura() (abaixo) é que
// submete mesmo o FT ao endpoint registarFactura da AGT — mesmo princípio
// de agtSeriesService.solicitarSerie(): o envelope schema v2.0 construído
// aqui é enviado TAL E QUAL (agtSandboxClient.registarFactura() é só
// transporte, não decide a forma do payload), sem reassinar com o esquema
// pipe-delimited que agtSandboxSubmissionService.js usa para a submissão
// automática e silenciosa já feita na emissão da fatura (poService.js/
// contractService.js). submeterFatura() existe para uma resubmissão
// EXPLÍCITA e VISÍVEL do mesmo FT (ex.: ao confirmar o pagamento, ver
// paymentService.processPayment) — não substitui essa submissão automática,
// soma-se a ela.
//
// FR (fatura-recibo) fica preparado no `documentType` mas sem produtor
// automático: o modelo de "pagamento garantido" do KIXIMA separa sempre a
// fatura (após aceite da PO) do recibo (após o pagamento confirmado) — nunca
// há um documento único que una os dois.
const crypto = require('crypto');
const prisma = require('../config/database');
const { NotFoundError, ForbiddenError, ValidationError, AgtRecusadoError } = require('../utils/errors');
const faturacaoService = require('./faturacaoService');
const creditNoteService = require('./creditNoteService');
const taxService = require('./taxService');
const agtSigningService = require('./agtSigningService');
const agtSandboxClient = require('./agtSandboxClient');
const agtSeriesService = require('./agtSeriesService');

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

// Placeholder sancionado pela própria AGT para comprador doméstico sem NIF
// identificado ("poderá ser utilizado o valor '999999999'" — spec oficial,
// 4.1.6, linha customerTaxID) — não é um valor inventado por nós.
const CUSTOMER_TAX_ID_DESCONHECIDO = '999999999';

function withholdingListDe(valor) {
  const v = round2(valor || 0);
  if (v <= 0) return [];
  return [{ withholdingTaxType: 'IRT', withholdingTaxDescription: 'Retenção na fonte', withholdingTaxAmount: v }];
}

// "<tipo> <seriesCode>/<número>" — delega em
// agtSeriesService.atribuirDocumentNo(), que atribui o número ATOMICAMENTE a
// partir da série REAL da AGT (nunca a série fiscal interna,
// Invoice/CreditNote/Payment.serie — essa é a cadeia de hash própria do
// KIXIMA, independente desta). Foi exatamente o fallback anterior
// (`doc.reference`, ex.: "FT FAT-2026-000009") que a AGT recusou numa
// submissão real de registarFactura. Idempotente e gravado no próprio
// documento (`agtDocumentNo`) — chamadas repetidas do mesmo payload (preview,
// reenvio no pagamento) devolvem sempre o mesmo número.
async function numeroDocumento(tipo, doc) {
  const ano = doc.assinadaEm ? new Date(doc.assinadaEm).getFullYear() : new Date().getFullYear();
  return agtSeriesService.atribuirDocumentNo(tipo, doc.id, { ano });
}

function clienteDe(documentoComPoOuContrato) {
  return documentoComPoOuContrato.purchaseOrder?.buyerCompany || documentoComPoOuContrato.contract?.clientCompany || null;
}

/**
 * Monta o objeto comum a FT/NC/RC dentro de `documents[]` — envelope de
 * campos e assinatura partilhados; só `lines`/`documentTotals`/
 * `withholdingTaxList`/`paymentReceipt` variam por tipo (recebidos já
 * prontos). `paymentReceipt` só é passado pelo RC — nos outros tipos fica
 * `undefined`, o que o `JSON.stringify` (aqui e no `res.json()` da rota) omite
 * do JSON final, tal como a spec exige ("não preenchido para os demais
 * tipos", 4.1.6) — nunca `null`. `withholdingTaxList` segue o mesmo
 * tratamento quando vem vazia: uma recusa real da AGT (registarFactura)
 * mostrou `"withholdingTaxList": []` a ser enviado sem necessidade — sem
 * retenção, o campo fica de fora, não `[]`.
 */
function montarDocumentoComum({ documentType, documentNo, dataDocumento, dataCriacao, taxRegistrationNumber, cliente, linhas, documentTotals, withholdingTaxList, paymentReceipt }) {
  const documentDate = new Date(dataDocumento || dataCriacao || Date.now()).toISOString().slice(0, 10);
  const systemEntryDate = new Date(dataCriacao || dataDocumento || Date.now()).toISOString();
  const customerTaxID = cliente?.taxId || CUSTOMER_TAX_ID_DESCONHECIDO;
  const customerCountry = paisISO(cliente?.country);
  const companyName = cliente?.name || 'Desconhecido';

  return {
    documentNo,
    documentStatus: 'N',
    jwsDocumentSignature: agtSigningService.assinarDocumento({
      documentNo, taxRegistrationNumber, documentType, documentDate, customerTaxID, customerCountry, companyName, documentTotals,
    }),
    documentDate,
    documentType,
    systemEntryDate,
    customerTaxID,
    customerCountry,
    companyName,
    lines: linhas,
    paymentReceipt,
    documentTotals,
    withholdingTaxList: withholdingTaxList?.length ? withholdingTaxList : undefined,
  };
}

async function documentoDeFatura(invoice, fornecedorTaxId) {
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
    documentNo: await numeroDocumento('FT', invoice),
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
async function documentoDeNotaCredito(creditNote, fornecedorTaxId) {
  const invoice = creditNote.invoice;
  const cliente = clienteDe(invoice);
  const faturaOriginalNo = await numeroDocumento('FT', invoice);
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
    documentNo: await numeroDocumento('NC', creditNote),
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
// `paymentReceipt` é obrigatório neste tipo (spec oficial, 4.1.6): aponta
// para o documento pago (`originatingON`/`documentDate` da FT, valor sem
// impostos em `creditAmount`) — é este campo, não `lines`, que liga o recibo
// à fatura que quita.
async function documentoDeRecibo(payment, fornecedorTaxId) {
  const invoice = payment.invoice;
  const cliente = clienteDe(invoice);
  const faturaNo = await numeroDocumento('FT', invoice);
  const faturaData = new Date(invoice.assinadaEm || invoice.createdAt).toISOString().slice(0, 10);

  return montarDocumentoComum({
    documentType: 'RC',
    documentNo: await numeroDocumento('RC', payment),
    dataDocumento: payment.assinadaEm,
    dataCriacao: payment.processedAt,
    taxRegistrationNumber: fornecedorTaxId,
    cliente,
    linhas: [],
    paymentReceipt: {
      sourceDocuments: [{
        lineNo: 1,
        sourceDocumentID: { originatingON: faturaNo, documentDate: faturaData },
        creditAmount: Number(invoice.netAmount || 0),
      }],
    },
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
    schemaVersion: '2.0',
    submissionUUID: crypto.randomUUID(),
    taxRegistrationNumber,
    submissionTimeStamp: new Date().toISOString(),
    softwareInfo: agtSigningService.construirSoftwareInfo(),
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
    return envelope(fornecedor.taxId, await documentoDeFatura(invoice, fornecedor.taxId));
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
    return envelope(fornecedor.taxId, await documentoDeNotaCredito(creditNote, fornecedor.taxId));
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
    return envelope(fornecedor.taxId, await documentoDeRecibo(payment, fornecedor.taxId));
  }

  throw new ValidationError(
    `Tipo de documento "${tipo}" não suportado. Use FT, NC ou RC — FR não tem produtor automático no KIXIMA: `
    + 'a fatura e o recibo são sempre documentos separados no modelo de pagamento garantido.',
  );
}

/**
 * Constrói o payload FT (construirPayload, acima) e SUBMETE-O mesmo ao
 * endpoint registarFactura da AGT — ver o comentário no topo do ficheiro
 * sobre a diferença para a submissão automática/silenciosa
 * (agtSandboxSubmissionService.js).
 *
 * Lança AgtRecusadoError (502) se a AGT recusar — mesmo princípio de
 * agtSeriesService.solicitarSerie(): nunca deixa o AgtApiError original (um
 * Error simples) propagar sem contexto de HTTP. `payload` viaja em
 * error.details.pedido para quem chama poder mostrar o que foi enviado,
 * mesmo numa recusa.
 */
async function submeterFatura(invoiceId, supplierCompanyId) {
  const payload = await construirPayload('FT', invoiceId, supplierCompanyId);
  let resposta;
  try {
    resposta = await agtSandboxClient.registarFactura(payload);
  } catch (erro) {
    if (erro instanceof agtSandboxClient.AgtApiError) {
      throw new AgtRecusadoError(erro, payload);
    }
    throw erro;
  }
  return { payload, resposta };
}

module.exports = { construirPayload, submeterFatura };
