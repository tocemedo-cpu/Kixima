// src/services/agtSandboxClient.js
// Cliente REST da Sandbox/homologação da AGT (e-Fatura) — módulo
// independente, focado ESTRITAMENTE na comunicação de rede: gerar os 3
// tokens JWS exigidos pela AGT e chamar os 4 endpoints. Não constrói o
// payload de negócio da fatura/nota de crédito/recibo — isso continua a
// cargo de quem chama (ex.: agtPayloadService.js já monta o documento a
// partir do que o KIXIMA gera internamente; passa-se aqui o resultado).
//
// PORQUÊ É QUE ISTO NÃO REAPROVEITA agtSigningService.js: aquele assina
// objetos JSON (payload = JSON.stringify(objeto)), conforme a spec técnica
// SETIC-FP DS.120 §4.1.6 usada para o envelope schema v1.2. A Sandbox REST
// aqui documentada exige duas das três assinaturas como STRING concatenada
// por "|" (barra vertical) — um payload byte a byte diferente, logo uma
// assinatura diferente. Confirmado pela documentação oficial da Sandbox
// (não uma suposição). As credenciais (chave privada, id/versão do software,
// número de validação) continuam a vir de config/env.js — uma só fonte,
// para não haver duas leituras divergentes da mesma chave.
//
// ASSUNÇÕES A CONFIRMAR CONTRA A DOCUMENTAÇÃO DA SANDBOX ANTES DE PRODUÇÃO
// (marcadas onde se aplicam, para não fingir uma certeza que não existe):
//   1. Autenticação HTTP Basic (Authorization: Basic base64(user:pass)) —
//      é a leitura mais direta de "autenticação por HTTP Headers, sem
//      OAuth2", mas a AGT pode exigir headers próprios (ex.: X-Username/
//      X-Password) em vez do Authorization Basic padrão.
//   2. Verbo/forma de obterEstado, consultarFactura e listarFacturas (aqui
//      GET + query string) — só registarFactura (POST, corpo JSON) foi
//      explicitamente descrito como submissão.
//   3. Serialização de `documentTotals` dentro da string do jwsDocumentSignature
//      quando é um objeto {taxPayable, netTotal, grossTotal} — aqui vai como
//      JSON.stringify(documentTotals); se a AGT esperar outro achatamento
//      (ex.: só o grossTotal), ajustar assinarDocumento().
//
// RECUSA-SE A FINGIR (mesmo princípio de multicaixaService.js/
// agtSigningService.js): sem a chave privada, o número de validação e as
// credenciais da Sandbox configuradas, nenhuma função aqui chama a rede nem
// devolve uma resposta simulada — lança, a dizer exatamente o que falta.
const crypto = require('crypto');
const config = require('../config/env');

const ENDPOINTS = {
  registarFactura: 'registarFactura',
  obterEstado: 'obterEstado',
  consultarFactura: 'consultarFactura',
  listarFacturas: 'listarFacturas',
};

const CONFIG = {
  jwsPrivateKeyPem: config.agt.jwsPrivateKeyPem,
  softwareValidationNumber: config.agt.softwareValidationNumber,
  sandboxBaseUrl: config.agt.sandboxBaseUrl,
  sandboxUsername: config.agt.sandboxUsername,
  sandboxPassword: config.agt.sandboxPassword,
};

const NOME_VARIAVEL = {
  jwsPrivateKeyPem: 'AGT_JWS_PRIVATE_KEY_BASE64',
  softwareValidationNumber: 'AGT_SOFTWARE_VALIDATION_NUMBER',
  sandboxBaseUrl: 'AGT_SANDBOX_BASE_URL',
  sandboxUsername: 'AGT_SANDBOX_USERNAME',
  sandboxPassword: 'AGT_SANDBOX_PASSWORD',
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
      'Ligação à Sandbox da AGT não está configurada. Em falta: '
      + falta.join(', ')
      + '. Sem a chave privada e as credenciais REAIS da Sandbox, nenhum pedido é enviado — este cliente não simula respostas da AGT.',
    );
  }
}

// Estado para o painel de Prontidão — mesmo formato de multicaixaService.estado()/
// agtSigningService.estado().
function estado() {
  return {
    canal: 'AGT_SANDBOX',
    disponivel: disponivel(),
    emFalta: emFalta(),
    nota: disponivel()
      ? 'Configurado.'
      : 'Implementado contra a documentação da Sandbox de homologação, por ligar. Requer credenciais reais.',
  };
}

// --- Erro tipado -------------------------------------------------------------

/**
 * Erro de negócio devolvido pela AGT — sempre que `resultCode` vem diferente
 * de "0", a resposta é tratada como recusa, nunca como sucesso parcial.
 * `errorList` é exposta tal como a AGT a devolveu, para quem chama decidir o
 * que fazer com cada erro (não se resume nem se traduz aqui).
 */
class AgtApiError extends Error {
  constructor(endpoint, resultCode, errorList) {
    super(`AGT recusou o pedido a "${endpoint}" (resultCode=${resultCode}): ${JSON.stringify(errorList || [])}`);
    this.name = 'AgtApiError';
    this.endpoint = endpoint;
    this.resultCode = resultCode;
    this.errorList = errorList || [];
  }
}

// --- JWS (Base64URL, RS256) ---------------------------------------------------

function base64url(bufferOuTexto) {
  const buf = Buffer.isBuffer(bufferOuTexto) ? bufferOuTexto : Buffer.from(String(bufferOuTexto), 'utf8');
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * JWS compacto RS256 sobre um conteúdo BRUTO (não faz JSON.stringify) —
 * cabeçalho fixo {"typ":"JOSE","alg":"RS256"}, igual ao usado no envelope
 * schema v1.2. Quem chama decide se o conteúdo é uma string pipe-delimited
 * ou um JSON já serializado — esta função só assina bytes.
 */
function assinarJWS(conteudoBruto) {
  exigirConfiguracao();
  const headerB64 = base64url(JSON.stringify({ typ: 'JOSE', alg: 'RS256' }));
  const payloadB64 = base64url(conteudoBruto);
  const assinatura = crypto.sign('RSA-SHA256', Buffer.from(`${headerB64}.${payloadB64}`, 'utf8'), CONFIG.jwsPrivateKeyPem);
  return `${headerB64}.${payloadB64}.${base64url(assinatura)}`;
}

/**
 * jwsSoftwareSignature — assina o OBJETO softwareInfoDetail (JSON), tal como
 * descrito: productId, productVersion, softwareValidationNumber, por esta
 * ordem.
 */
function assinarSoftware() {
  const softwareInfoDetail = {
    productId: config.agt.softwareId,
    productVersion: config.agt.softwareVersion,
    softwareValidationNumber: config.agt.softwareValidationNumber,
  };
  return { softwareInfoDetail, jwsSoftwareSignature: assinarJWS(JSON.stringify(softwareInfoDetail)) };
}

// `documentTotals` pode chegar como objeto ({taxPayable, netTotal, grossTotal})
// ou já como texto — achata para um único token da string pipe-delimited sem
// decidir formato por conta de quem chama.
function textoDe(valor) {
  if (valor == null) return '';
  return typeof valor === 'object' ? JSON.stringify(valor) : String(valor);
}

/**
 * jwsDocumentSignature — assina a STRING concatenada por "|", exatamente
 * nesta ordem: documentNo, taxRegistrationNumber, documentType, documentDate,
 * customerTaxID, customerCountry, companyName, documentTotals.
 */
function assinarDocumento({ documentNo, taxRegistrationNumber, documentType, documentDate, customerTaxID, customerCountry, companyName, documentTotals }) {
  const texto = [documentNo, taxRegistrationNumber, documentType, documentDate, customerTaxID, customerCountry, companyName, textoDe(documentTotals)].join('|');
  return assinarJWS(texto);
}

/**
 * jwsSignature — assina a STRING da solicitação global: taxRegistrationNumber
 * e submissionUUID, separados por "|".
 */
function assinarSolicitacao({ taxRegistrationNumber, submissionUUID }) {
  return assinarJWS(`${taxRegistrationNumber}|${submissionUUID}`);
}

// --- Comunicação HTTP ---------------------------------------------------------

function cabecalhosAutenticacao() {
  const credenciais = Buffer.from(`${config.agt.sandboxUsername}:${config.agt.sandboxPassword}`, 'utf8').toString('base64');
  return {
    'Content-Type': 'application/json',
    Authorization: `Basic ${credenciais}`,
  };
}

function urlDe(endpoint, query) {
  const url = new URL(`${config.agt.sandboxBaseUrl.replace(/\/+$/, '')}/${endpoint}`);
  if (query) {
    for (const [chave, valor] of Object.entries(query)) {
      if (valor != null && valor !== '') url.searchParams.set(chave, valor);
    }
  }
  return url;
}

/**
 * Ponto único de chamada aos 4 endpoints — trata `resultCode`/`errorList`
 * uma só vez, para os 4 métodos abaixo não repetirem essa lógica.
 */
async function pedido(endpoint, { method = 'GET', body, query } = {}) {
  exigirConfiguracao();
  const url = urlDe(endpoint, query);

  const resposta = await fetch(url, {
    method,
    headers: cabecalhosAutenticacao(),
    body: body ? JSON.stringify(body) : undefined,
  });

  let dados = null;
  try {
    dados = await resposta.json();
  } catch {
    // Resposta sem corpo JSON (ex.: erro de gateway) — dados fica null,
    // tratado a seguir pelo `!resposta.ok`.
  }

  if (!resposta.ok) {
    throw new AgtApiError(endpoint, dados?.resultCode ?? String(resposta.status), dados?.errorList);
  }
  if (dados && String(dados.resultCode) !== '0') {
    throw new AgtApiError(endpoint, dados.resultCode, dados.errorList);
  }
  return dados;
}

/**
 * POST /registarFactura — submete um documento já assinado (envelope com
 * `jwsSoftwareSignature`/`jwsDocumentSignature`/`jwsSignature` incluídos, tal
 * como construído por quem chama). Este cliente não decide a forma do
 * envelope — só transporta.
 */
async function registarFactura(documento) {
  return pedido(ENDPOINTS.registarFactura, { method: 'POST', body: documento });
}

/** GET /obterEstado — estado do processamento de uma submissão. */
async function obterEstado({ submissionUUID, documentNo } = {}) {
  return pedido(ENDPOINTS.obterEstado, { query: { submissionUUID, documentNo } });
}

/** GET /consultarFactura — detalhe de uma fatura já registada. */
async function consultarFactura({ documentNo, taxRegistrationNumber } = {}) {
  return pedido(ENDPOINTS.consultarFactura, { query: { documentNo, taxRegistrationNumber } });
}

/** GET /listarFacturas — listagem paginada, filtrável por período. */
async function listarFacturas({ taxRegistrationNumber, dataInicio, dataFim, pagina, tamanhoPagina } = {}) {
  return pedido(ENDPOINTS.listarFacturas, {
    query: { taxRegistrationNumber, dataInicio, dataFim, pagina, tamanhoPagina },
  });
}

module.exports = {
  // Configuração / prontidão
  disponivel, emFalta, exigirConfiguracao, estado,
  // Assinaturas JWS
  assinarJWS, assinarSoftware, assinarDocumento, assinarSolicitacao,
  // Endpoints da Sandbox
  registarFactura, obterEstado, consultarFactura, listarFacturas,
  // Erro tipado
  AgtApiError,
};
