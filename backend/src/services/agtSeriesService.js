// src/services/agtSeriesService.js
// Pedido de série de numeração à AGT ("Solicitar Série", spec DS.120, 4.5)
// — pré-requisito documentado para poder emitir qualquer documento com uma
// série própria: o `documentNo` de um documento de facturação tem de conter
// um `seriesCode` atribuído pela AGT, nunca inventado. O script
// scripts/agt-certificacao-c1-fr.js usava "CERT-FR" — uma série fictícia,
// nunca pedida à AGT — provável causa adicional (a par das credenciais de
// software) do erro 500 na primeira submissão do caso C1.
//
// construirPedidoSerie() só gera e assina — tal como agtPayloadService.js,
// sem cliente de rede. solicitarSerie() (abaixo) é que submete mesmo,
// reaproveitando agtSandboxClient.js (cliente REST já testado, só
// transporte — não decide a forma do pedido, só o envia) em vez de
// duplicar aqui lógica de URL/autenticação/tratamento de resposta.
//
// DECISÃO NÃO CONFIRMADA: os campos assinados em `jwsSignature` para este
// pedido específico. A tabela da spec (4.5.27) descreve-os literalmente
// como "taxRegistrationNumber, requestID" — mas solicitarSerie não recebe
// nenhum requestID como parâmetro de entrada. Esse texto repete-se sem
// alteração nas secções de obterEstado/consultarFactura, onde faz sentido
// (ambos referenciam o requestID de uma submissão de facturas anterior);
// aqui tudo indica ser um copy-paste da spec, não uma indicação real para
// este pedido. Assina-se por isso o conjunto de campos que definem ESTE
// pedido (mesmo padrão do jwsDocumentSignature, que assina os campos do
// próprio documento, não de outro) — ajustar aqui, e só aqui, se a AGT
// devolver erro especificamente sobre esta assinatura.
const crypto = require('crypto');
const config = require('../config/env');
const logger = require('../config/logger');
const prisma = require('../config/database');
const agtSigningService = require('./agtSigningService');
const agtSandboxClient = require('./agtSandboxClient');
const { AgtRecusadoError, BusinessRuleError } = require('../utils/errors');

// FT -> Invoice, NC -> CreditNote, RC -> Payment — mesma correspondência que
// agtSandboxSubmissionService.js já usa (ENTIDADE_POR_TIPO), aqui para saber
// em qual tabela gravar o `agtDocumentNo` atribuído.
const MODELO_POR_TIPO = { FT: 'invoice', NC: 'creditNote', RC: 'payment' };

/**
 * `documentType` ∈ os mesmos valores de agtPayloadService/DS.120 (FT, FR,
 * NC, RC, ND, ...). `seriesContingencyIndicator`: "N" (regime normal) ou
 * "C" (contingência) — "N" por omissão, é o caso comum.
 */
function construirPedidoSerie({ taxRegistrationNumber, seriesYear, documentType, establishmentNumber, seriesContingencyIndicator = 'N' }) {
  logger.info('Solicitar Série: a construir pedido', {
    taxRegistrationNumber, seriesYear, documentType, establishmentNumber, seriesContingencyIndicator,
  });

  // dadosAssinatura: exatamente os campos que entram na assinatura JWS deste
  // pedido — nomeado à parte para ficar claro que é este o conjunto que
  // importa conferir (ver o resumo "Dados assinados" no frontend,
  // SolicitarSerie.jsx, e o logger.info completo abaixo — nenhum dos dois
  // precisa de um console.log à parte para se ver isto).
  const dadosAssinatura = {
    taxRegistrationNumber, seriesYear, documentType, establishmentNumber, seriesContingencyIndicator,
  };

  const jwsSignature = agtSigningService.assinarJWS(dadosAssinatura);

  const pedido = {
    schemaVersion: '2.0',
    submissionUUID: crypto.randomUUID(),
    taxRegistrationNumber,
    submissionTimeStamp: new Date().toISOString(),
    softwareInfo: agtSigningService.construirSoftwareInfo(),
    jwsSignature,
    seriesYear,
    documentType,
    establishmentNumber,
    seriesContingencyIndicator,
  };

  // Nada aqui é segredo — jwsSignature é o que já sai na resposta da rota, a
  // chave privada nunca passa por este log. Ver o pedido completo tal como
  // vai para a AGT ajuda a diagnosticar sem ter de reproduzir o pedido à
  // parte.
  logger.info('Solicitar Série: pedido construído e assinado', pedido);

  return pedido;
}

/**
 * Constrói o pedido (construirPedidoSerie, acima) e SUBMETE-O mesmo ao
 * endpoint solicitarSerie da AGT — agtSandboxClient.solicitarSerie() é só
 * transporte (resolve o URL por AGT_ENV, HTTP Basic, trata resultCode/
 * errorList da resposta); não decide a forma do pedido, só o envia tal como
 * construirPedidoSerie o construiu.
 *
 * Lança AgtRecusadoError (502) se a AGT recusar — nunca deixa o AgtApiError
 * original (um Error simples) propagar sem contexto de HTTP, mesmo princípio
 * de ServiceUnavailableError para configuração em falta. CONFIRMADO em
 * produção: quem decide sucesso/recusa é agtSandboxClient.solicitarSerie()
 * (presença de seriesFEResult.seriesCode, não resultCode "0" — a AGT devolve
 * resultCode=1 mesmo quando aceita); esta função só reage ao que aquele
 * decidiu, não repete a lógica.
 *
 * `contexto.solicitadoPorId`/`solicitadoPorNome` (opcionais, vêm de
 * req.user na rota) só servem para a linha gravada em AgtSeriesFe abaixo —
 * não entram no pedido nem na assinatura.
 */
async function solicitarSerie(params, contexto = {}) {
  const pedido = construirPedidoSerie(params);

  logger.info('Solicitar Série: a submeter à AGT (solicitarSerie)', { submissionUUID: pedido.submissionUUID });
  let resposta;
  try {
    resposta = await agtSandboxClient.solicitarSerie(pedido);
  } catch (erro) {
    if (erro instanceof agtSandboxClient.AgtApiError) {
      logger.warn('Solicitar Série: a AGT recusou o pedido', {
        submissionUUID: pedido.submissionUUID, resultCode: erro.resultCode, errorList: erro.errorList,
      });
      throw new AgtRecusadoError(erro, pedido);
    }
    throw erro;
  }
  logger.info('Solicitar Série: resposta da AGT', { submissionUUID: pedido.submissionUUID, resposta });

  // Só se chega aqui quando a AGT aceitou (agtSandboxClient já confirmou
  // seriesFEResult.seriesCode — qualquer outra resposta já teria lançado
  // AgtRecusadoError acima). Grava-se o histórico (AgtSeriesFe) exatamente
  // com o que foi submetido e o que a AGT devolveu em seriesFEResult —
  // nunca um valor inventado: se algum destes campos não vier na resposta,
  // fica null, não um valor a adivinhar.
  const seriesFEResult = resposta?.seriesFEResult || {};
  await prisma.agtSeriesFe.create({
    data: {
      ano: pedido.seriesYear,
      tipoDocumento: pedido.documentType,
      establishmentNumber: pedido.establishmentNumber,
      taxRegistrationNumber: pedido.taxRegistrationNumber,
      seriesCode: seriesFEResult.seriesCode ?? null,
      authorizedQuantity: seriesFEResult.authorizedQuantity != null ? String(seriesFEResult.authorizedQuantity) : null,
      firstDocumentNo: seriesFEResult.firstDocumentNo != null ? String(seriesFEResult.firstDocumentNo) : null,
      lastDocumentNo: seriesFEResult.lastDocumentNo != null ? String(seriesFEResult.lastDocumentNo) : null,
      submissionUUID: pedido.submissionUUID,
      requestID: resposta?.requestID ?? null,
      resultCode: String(resposta?.resultCode ?? ''),
      solicitadoPorId: contexto.solicitadoPorId ?? null,
      solicitadoPorNome: contexto.solicitadoPorNome ?? null,
    },
  });

  return { pedido, resposta };
}

/**
 * Histórico de pedidos "Solicitar Série" já aceites pela AGT — o mais
 * recente primeiro. Usado pela página SolicitarSerie.jsx em vez do JSON
 * bruto do último pedido: mostra o que está mesmo gravado, não só o que
 * acabou de acontecer nesta sessão do browser.
 */
async function listarHistorico() {
  return prisma.agtSeriesFe.findMany({ orderBy: { createdAt: 'desc' } });
}

/**
 * A série ATUALMENTE atribuída pela AGT para um tipo de documento (FT, FR,
 * NC, RC, ND, ...) — a mais recente aceite para esse tipo/ano/
 * estabelecimento (por omissão o ano em curso e o AGT_ESTABLISHMENT_NUMBER
 * configurado). Devolve `null` quando nunca se pediu série nenhuma desse
 * tipo — NUNCA inventa um seriesCode; quem chama decide o que fazer com
 * `null` (ex.: bloquear a emissão do documento, em vez de usar uma série
 * fictícia como "CERT-FR" — ver o comentário no topo deste ficheiro, a
 * causa documentada de um erro 500 real).
 */
async function obterSeriePorTipo(documentType, { ano = new Date().getFullYear(), establishmentNumber = config.agt.establishmentNumber } = {}) {
  if (!documentType || !String(documentType).trim()) {
    throw new Error('obterSeriePorTipo: documentType é obrigatório.');
  }
  return prisma.agtSeriesFe.findFirst({
    where: {
      tipoDocumento: String(documentType).trim().toUpperCase(),
      ano: Number(ano),
      establishmentNumber,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Atribui, UMA ÚNICA VEZ, o `documentNo` REAL da AGT a um documento (FT/NC/
 * RC) — "<tipo> <seriesCode>/<número>", onde `seriesCode` vem da série que a
 * AGT concedeu (AgtSeriesFe) e `número` é um contador ATÓMICO por série
 * (`AgtSeriesFe.ultimoNumero`), NUNCA a série fiscal interna
 * (Invoice/CreditNote/Payment.serie — essa é a cadeia de hash própria do
 * KIXIMA, um mecanismo à parte e opcional). Por ser independente da série
 * interna, funciona mesmo para documentos criados antes de
 * `Company.serieFiscal` alguma vez ter sido declarada.
 *
 * `taxRegistrationNumber` é OBRIGATÓRIO e faz parte da procura: uma série é
 * concedida pela AGT a um NIF específico (ver "Solicitar Série" em
 * agtSeriesRoutes/faturacaoRoutes — agora por fornecedor, cada um com o seu
 * próprio NIF real), nunca "a mais recente para este tipo/ano" às cegas. Sem
 * este filtro, um documento podia ser assinado com o NIF do fornecedor A mas
 * numerado com uma série que a AGT atribuiu ao fornecedor B — a AGT recusa
 * essa combinação (confirmado em produção: 503 sem detalhe, ao contrário de
 * um erro de validação normal), porque a série não pertence a quem a está a
 * usar.
 *
 * Idempotente: se o documento já tem `agtDocumentNo` gravado, devolve-o tal
 * qual, sem consumir outro número — chamadas repetidas do mesmo payload
 * (preview em GET /agt-payload, reenvio no pagamento) têm de dar sempre o
 * mesmo resultado. `SELECT ... FOR UPDATE` bloqueia a linha da série até ao
 * fim da transação, mesmo mecanismo de faturacaoService.atribuir() — duas
 * atribuições simultâneas ficam em fila, nunca com o mesmo número.
 *
 * Lança BusinessRuleError (nunca inventa um `seriesCode`) quando ainda não
 * existe nenhuma série aceite pela AGT para este NIF/tipo/ano/estabelecimento
 * — quem chama tem de pedir a série primeiro ("Solicitar Série"), para esta
 * empresa especificamente.
 */
async function atribuirDocumentNo(tipo, id, { ano = new Date().getFullYear(), establishmentNumber = config.agt.establishmentNumber, taxRegistrationNumber } = {}) {
  const modelo = MODELO_POR_TIPO[tipo];
  if (!modelo) {
    throw new Error(`atribuirDocumentNo: tipo "${tipo}" não suportado (use FT, NC ou RC).`);
  }
  if (!taxRegistrationNumber) {
    throw new Error('atribuirDocumentNo: taxRegistrationNumber é obrigatório — a série pertence a um NIF específico.');
  }

  return prisma.$transaction(async (tx) => {
    const existente = await tx[modelo].findUnique({ where: { id }, select: { agtDocumentNo: true } });
    if (existente?.agtDocumentNo) return existente.agtDocumentNo;

    const [linha] = await tx.$queryRaw`
      SELECT "id", "series_code", "ultimo_numero"
        FROM "agtseriesfe"
       WHERE "tipo_documento" = ${String(tipo).toUpperCase()}
         AND "ano" = ${Number(ano)}
         AND "establishment_number" = ${establishmentNumber}
         AND "tax_registration_number" = ${taxRegistrationNumber}
       ORDER BY "created_at" DESC
       LIMIT 1
       FOR UPDATE
    `;
    if (!linha || !linha.series_code) {
      throw new BusinessRuleError(
        `Não existe nenhuma série atribuída pela AGT ao NIF "${taxRegistrationNumber}" para documentos do tipo "${tipo}" no ano ${ano}. `
        + 'Peça a série primeiro ("Solicitar Série", para esta empresa) antes de emitir ou reenviar este documento.',
      );
    }

    const numero = Number(linha.ultimo_numero) + 1;
    await tx.$executeRaw`UPDATE "agtseriesfe" SET "ultimo_numero" = ${numero} WHERE "id" = ${linha.id}`;

    const documentNo = `${tipo} ${linha.series_code}/${numero}`;
    await tx[modelo].update({ where: { id }, data: { agtDocumentNo: documentNo } });
    return documentNo;
  });
}

module.exports = { construirPedidoSerie, solicitarSerie, listarHistorico, obterSeriePorTipo, atribuirDocumentNo };
