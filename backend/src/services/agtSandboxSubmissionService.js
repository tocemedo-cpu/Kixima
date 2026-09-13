// src/services/agtSandboxSubmissionService.js
// Liga agtSandboxClient.js (cliente REST, só transporte) à emissão REAL de
// faturas/notas de crédito/recibos — sem isto, o cliente estava pronto e
// testado mas nunca era chamado por nenhuma rota/serviço (achado N10 da
// auditoria de arquitetura).
//
// REAPROVEITA agtPayloadService.construirPayload() para os campos comuns
// (documentNo, documentDate, customerTaxID, customerCountry, companyName,
// documentTotals) e a verificação de posse — essa função já sabe carregar
// Invoice/CreditNote/Payment e confirmar que pertencem a supplierCompanyId.
// Só se assina de novo com o esquema PRÓPRIO da Sandbox REST (assinaturas
// pipe-delimited, ver agtSandboxClient.js) em vez do esquema v1.2 (schema
// JSON) que construirPayload gera para outro consumidor (GET /agt-payload).
//
// MESMO PRINCÍPIO "RECUSA-SE A FINGIR": sem a Sandbox configurada
// (agtSandboxClient.disponivel() === false), esta função não faz nada — não
// é um erro, é simplesmente "ainda não ligado". A emissão do documento em si
// (já feita por quem chama, antes desta função) nunca depende disto.
//
// NUNCA LANÇA: é sempre chamada depois de o documento fiscal já ter sido
// criado e comitado — uma falha aqui (rede, Sandbox fora do ar, resposta com
// erro) fica registada em auditoria, mas não pode desfazer nem bloquear a
// emissão já efetivada.
const crypto = require('crypto');
const agtSandboxClient = require('./agtSandboxClient');
const agtPayloadService = require('./agtPayloadService');
const auditService = require('./auditService');

const ENTIDADE_POR_TIPO = { FT: 'Invoice', NC: 'CreditNote', RC: 'Payment' };

/**
 * Submete um documento (FT | NC | RC) já emitido à Sandbox da AGT.
 * `tipo`/`id`/`supplierCompanyId` têm o mesmo significado de
 * agtPayloadService.construirPayload — é essa função que carrega o
 * documento e confirma a posse antes de qualquer assinatura.
 */
async function submeter(tipo, id, supplierCompanyId) {
  if (!agtSandboxClient.disponivel()) return; // ainda por configurar — silencioso, não é falha

  const entityType = ENTIDADE_POR_TIPO[tipo];
  try {
    const envelopeV12 = await agtPayloadService.construirPayload(tipo, id, supplierCompanyId);
    const doc = envelopeV12.documents[0];
    const taxRegistrationNumber = envelopeV12.taxRegistrationNumber;

    const { softwareInfoDetail, jwsSoftwareSignature } = agtSandboxClient.assinarSoftware();
    const jwsDocumentSignature = agtSandboxClient.assinarDocumento({
      documentNo: doc.documentNo,
      taxRegistrationNumber,
      documentType: doc.documentType,
      documentDate: doc.documentDate,
      customerTaxID: doc.customerTaxID,
      customerCountry: doc.customerCountry,
      companyName: doc.companyName,
      documentTotals: doc.documentTotals,
    });
    const submissionUUID = crypto.randomUUID();
    const jwsSignature = agtSandboxClient.assinarSolicitacao({ taxRegistrationNumber, submissionUUID });

    const documento = {
      documentNo: doc.documentNo,
      documentType: doc.documentType,
      documentDate: doc.documentDate,
      taxRegistrationNumber,
      customerTaxID: doc.customerTaxID,
      customerCountry: doc.customerCountry,
      companyName: doc.companyName,
      documentTotals: doc.documentTotals,
      softwareInfoDetail,
      jwsSoftwareSignature,
      jwsDocumentSignature,
      submissionUUID,
      jwsSignature,
    };

    const resposta = await agtSandboxClient.registarFactura(documento);

    await auditService.recordSafe({
      action: 'AGT_SANDBOX_SUBMETIDO',
      entityType,
      entityId: id,
      detail: { tipo, documentNo: doc.documentNo, submissionUUID, resultCode: resposta?.resultCode ?? null },
    });
  } catch (err) {
    await auditService.recordSafe({
      action: 'AGT_SANDBOX_FALHOU',
      entityType,
      entityId: id,
      detail: { tipo, erro: err.message },
    });
  }
}

module.exports = { submeter };
