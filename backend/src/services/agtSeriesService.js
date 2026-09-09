// src/services/agtSeriesService.js
// Pedido de série de numeração à AGT ("Solicitar Série", spec DS.120, 4.5)
// — pré-requisito documentado para poder emitir qualquer documento com uma
// série própria: o `documentNo` de um documento de facturação tem de conter
// um `seriesCode` atribuído pela AGT, nunca inventado. O script
// scripts/agt-certificacao-c1-fr.js usava "CERT-FR" — uma série fictícia,
// nunca pedida à AGT — provável causa adicional (a par das credenciais de
// software) do erro 500 na primeira submissão do caso C1.
//
// SÓ GERA E ASSINA O PEDIDO — tal como agtPayloadService.js, não há cliente
// de rede aqui; quem submete ao endpoint da AGT é quem tem acesso à conta
// de homologação/produção.
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
const agtSigningService = require('./agtSigningService');

/**
 * `documentType` ∈ os mesmos valores de agtPayloadService/DS.120 (FT, FR,
 * NC, RC, ND, ...). `seriesContingencyIndicator`: "N" (regime normal) ou
 * "C" (contingência) — "N" por omissão, é o caso comum.
 */
function construirPedidoSerie({ taxRegistrationNumber, seriesYear, documentType, establishmentNumber, seriesContingencyIndicator = 'N' }) {
  const jwsSignature = agtSigningService.assinarJWS({
    taxRegistrationNumber, seriesYear, documentType, establishmentNumber, seriesContingencyIndicator,
  });

  return {
    schemaVersion: '1.2',
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
}

module.exports = { construirPedidoSerie };
