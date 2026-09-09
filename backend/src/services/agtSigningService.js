// src/services/agtSigningService.js
// Assinatura JWS/RS256 do payload de submissão AGT (e-Fatura, schema v1.2).
//
// LEIA ISTO ANTES DE USAR. Tal como o Multicaixa Express (multicaixaService.js),
// isto está implementado contra o formato observado em amostras reais da AGT,
// POR LIGAR: não existe chave privada nem número de validação atribuídos pela
// AGT nesta plataforma — a certificação é um processo administrativo que
// ainda não aconteceu.
//
// RECUSA-SE A FINGIR. Sem a chave e o número de validação configurados, cada
// função lança com uma mensagem que diz exatamente o que falta. Uma
// assinatura simulada num documento que se apresenta como fiscalmente válido
// é pior do que recusar-se a assinar.
//
// O QUE É UM JWS AQUI. Compacto de 3 partes (header.payload.assinatura),
// cabeçalho fixo {"typ":"JOSE","alg":"RS256"}. Os campos assinados em cada
// nível (software vs. documento) vêm da especificação técnica oficial da AGT
// (SETIC-FP, DS.120 "FE — Facturação Eletrónica", secção 4.1.6) — não das 3
// amostras JSON fornecidas antes, cujo `jwsSoftwareSignature`/
// `jwsDocumentSignature` afinal eram valores placeholder IDÊNTICOS entre FT/
// NC/FR (confirmado por comparação directa), logo não codificavam nada real.
// Não se usa a biblioteca `jsonwebtoken` (já usada para as sessões de
// utilizador): ela pressupõe a forma de um JWT e injeta campos (`iat`) que
// não pertencem a este payload — usa-se `crypto` nativo, o mesmo que já
// assina a cadeia de integridade local (ver faturacaoService.calcularHash).

const crypto = require('crypto');
const config = require('../config/env');

const CONFIG = {
  jwsPrivateKeyPem: config.agt.jwsPrivateKeyPem,
  softwareValidationNumber: config.agt.softwareValidationNumber,
};

// Nome da variável de ambiente correspondente, para a mensagem de erro dizer
// exatamente o que falta preencher.
const NOME_VARIAVEL = {
  jwsPrivateKeyPem: 'AGT_JWS_PRIVATE_KEY_BASE64',
  softwareValidationNumber: 'AGT_SOFTWARE_VALIDATION_NUMBER',
};

function emFalta() {
  return Object.entries(CONFIG)
    .filter(([, v]) => !String(v || '').trim())
    .map(([k]) => NOME_VARIAVEL[k] || k);
}

function disponivel() {
  return emFalta().length === 0;
}

function exigirConfiguracao() {
  const falta = emFalta();
  if (falta.length) {
    throw new Error(
      'Assinatura AGT não está configurada. Em falta: '
      + falta.join(', ')
      + '. Sem a chave e o número de validação REAIS da AGT, nenhum payload é assinado — este processo não simula certificação.',
    );
  }
}

function base64url(bufferOuTexto) {
  const buf = Buffer.isBuffer(bufferOuTexto) ? bufferOuTexto : Buffer.from(bufferOuTexto, 'utf8');
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * JWS compacto RS256 sobre um objeto JSON.
 *
 * A ordem das chaves no payload assinado é a ordem de inserção do objeto
 * passado (objetos JS preservam a ordem de inserção para chaves de texto) —
 * quem chama controla a forma exata do payload assinado só pela ordem em que
 * constrói o objeto, sem nenhuma serialização canónica à parte.
 */
function assinarJWS(payloadObj) {
  exigirConfiguracao();
  const headerB64 = base64url(JSON.stringify({ typ: 'JOSE', alg: 'RS256' }));
  const payloadB64 = base64url(JSON.stringify(payloadObj));
  const assinatura = crypto.sign('RSA-SHA256', Buffer.from(`${headerB64}.${payloadB64}`, 'utf8'), CONFIG.jwsPrivateKeyPem);
  return `${headerB64}.${payloadB64}.${base64url(assinatura)}`;
}

/**
 * `softwareInfo` do envelope — identifica o SOFTWARE (a KIXIMA), não o
 * documento. Campos assinados: exatamente os de `softwareInfoDetail`
 * (productId, productVersion, softwareValidationNumber) — "Todos os campos
 * do objecto softwareInfo devem ser usados na assinatura" (spec oficial,
 * 4.1.6, linha `jwsSoftwareSignature`); `taxRegistrationNumber` NÃO entra
 * aqui (é assinado no documento, não no software).
 */
function construirSoftwareInfo() {
  const detail = {
    productId: config.agt.softwareId,
    productVersion: config.agt.softwareVersion,
    softwareValidationNumber: config.agt.softwareValidationNumber,
  };
  return {
    softwareInfoDetail: detail,
    jwsSoftwareSignature: assinarJWS(detail),
  };
}

/**
 * `jwsDocumentSignature` — exatamente estes 8 campos, por esta ordem,
 * conforme a especificação oficial da AGT (SETIC-FP, DS.120, 4.1.6, linha
 * `jwsDocumentSignature`): "documentNo, taxRegistrationNumber, documentType,
 * documentDate, customerTaxID, customerCountry, companyName, documentTotals".
 */
function assinarDocumento({ documentNo, taxRegistrationNumber, documentType, documentDate, customerTaxID, customerCountry, companyName, documentTotals }) {
  return assinarJWS({ documentNo, taxRegistrationNumber, documentType, documentDate, customerTaxID, customerCountry, companyName, documentTotals });
}

// Estado para o painel de Prontidão — mesmo formato de multicaixaService.estado().
function estado() {
  return {
    canal: 'AGT_ASSINATURA',
    disponivel: disponivel(),
    emFalta: emFalta(),
    nota: disponivel()
      ? 'Configurado.'
      : 'Implementado contra o formato observado em amostras da AGT, por ligar. Requer certificação e chave privada reais.',
  };
}

module.exports = {
  assinarJWS, construirSoftwareInfo, assinarDocumento,
  disponivel, emFalta, exigirConfiguracao, estado,
};
