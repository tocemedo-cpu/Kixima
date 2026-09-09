// src/services/agtCertificacaoService.js
// Gerador de documentos AGT para os testes de CERTIFICAÇÃO/HOMOLOGAÇÃO do
// software junto da AGT (SETIC-FP, DS.120) — aceita dados SINTÉTICOS
// diretamente, ao contrário de agtPayloadService.js, que só monta payloads a
// partir de documentos reais (Invoice/CreditNote/Payment) já gravados no
// KIXIMA.
//
// Serve exclusivamente para exercitar, na homologação, cenários que a AGT
// exige testar mas que o KIXIMA nunca produz sozinho no seu próprio negócio
// — FR (fatura-recibo), compradores estrangeiros, região de Cabinda,
// isenções e tipos de imposto (IEC, IS) que a plataforma não cobra hoje.
// NADA daqui entra em nenhum fluxo real de fornecedor — nunca é chamado
// pelas rotas de faturação normais, só por scripts de geração de casos de
// teste (ver scripts/agt-certificacao-c1-fr.js).
//
// Reaproveita agtSigningService (a mesma assinatura JWS/RS256, os mesmos
// campos assinados) — não duplica a criptografia.
const crypto = require('crypto');
const agtSigningService = require('./agtSigningService');

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Placeholder que a própria AGT documenta para comprador sem NIF
// identificado ("poderá ser utilizado o valor '999999999'" — spec DS.120,
// 4.1.6, linha customerTaxID). A tabela da spec só o associa explicitamente
// a compradores domésticos, mas o validador real da AGT devolveu
// "customerTaxID: é obrigatório" também para um documento de comprador
// ESTRANGEIRO sem NIF — ou seja, na prática o campo é sempre obrigatório,
// apesar de a tabela impressa o marcar como opcional ("N") nesse caso. O
// comportamento real do validador é a fonte de verdade aqui, não a leitura
// da tabela; por isso usa-se o mesmo placeholder já sancionado pela AGT
// (nunca um valor inventado) em qualquer cenário sem NIF, doméstico ou não.
const CUSTOMER_TAX_ID_DESCONHECIDO = '999999999';

// Regra de arredondamento de imposto da própria spec (DS.120, 4.1.6,
// "taxContribution"): sempre POR EXCESSO ao cêntimo, nunca ao mais próximo.
// Testado contra os 3 exemplos da própria tabela da spec:
//   23,144 -> 23,15 | 0,001844 -> 0,01 | 5,9999999 -> 6,00
// NÃO usar "+ Number.EPSILON" aqui como no round() normal — isso empurraria
// um valor exatamente 0 para 0,01 (todo positivo, por menor que seja, sobe
// ao próximo inteiro no Math.ceil). Em vez disso, primeiro limpa-se o ruído
// binário arredondando os cêntimos a 6 casas decimais, só depois se aplica o
// ceiling — assim um valor genuinamente exato fica exato.
function arredondarPorExcesso(valor) {
  const centimos = Number(valor) * 100;
  const centimosLimpos = Math.round(centimos * 1e6) / 1e6;
  return Math.ceil(centimosLimpos) / 100;
}

/**
 * `taxContribution` de uma linha a partir de `net` e `percentagem` (em %),
 * já com o arredondamento por excesso da spec aplicado.
 */
function calcularContribuicao(net, percentagem) {
  return arredondarPorExcesso((Number(net) * Number(percentagem)) / 100);
}

/**
 * `documentTotals` a partir das linhas já construídas — soma o imposto de
 * todas as `taxes[]` de cada linha, e o valor líquido de
 * `creditAmount`/`debitAmount` (um dos dois, nunca ambos, por linha).
 */
function totaisDeLinhas(linhas) {
  const taxPayable = linhas.reduce(
    (soma, l) => soma + (l.taxes || []).reduce((s, t) => s + Number(t.taxContribution || 0), 0),
    0,
  );
  const netTotal = linhas.reduce((soma, l) => soma + Number(l.creditAmount || l.debitAmount || 0), 0);
  return { taxPayable: round2(taxPayable), netTotal: round2(netTotal), grossTotal: round2(taxPayable + netTotal) };
}

/**
 * Constrói UM documento para `documents[]` a partir de dados já prontos
 * (linhas, cliente, retenções) — quem chama decide o conteúdo fiscal exato,
 * porque é esse o objetivo aqui: exercitar cenários fora do que o KIXIMA
 * gera sozinho.
 *
 * `cliente.taxId` pode vir por preencher (comprador sem NIF identificado,
 * doméstico ou estrangeiro) — cai no placeholder que a própria AGT
 * documenta (`CUSTOMER_TAX_ID_DESCONHECIDO`), confirmado obrigatório pelo
 * validador real mesmo quando a tabela da spec o marcava "N" nalguns casos.
 */
function construirDocumento({ documentType, documentNo, taxRegistrationNumber, documentDate, cliente, linhas, withholdingTaxList = [] }) {
  const customerTaxID = cliente.taxId || CUSTOMER_TAX_ID_DESCONHECIDO;
  const customerCountry = cliente.country;
  const companyName = cliente.name;
  const documentTotals = totaisDeLinhas(linhas);

  return {
    documentNo,
    documentStatus: 'N',
    jwsDocumentSignature: agtSigningService.assinarDocumento({
      documentNo, taxRegistrationNumber, documentType, documentDate, customerTaxID, customerCountry, companyName, documentTotals,
    }),
    documentDate,
    documentType,
    systemEntryDate: new Date().toISOString(),
    customerTaxID,
    customerCountry,
    companyName,
    lines: linhas,
    documentTotals,
    withholdingTaxList,
  };
}

function envelope(taxRegistrationNumber, documentos) {
  return {
    schemaVersion: '1.2',
    submissionUUID: crypto.randomUUID(),
    taxRegistrationNumber,
    submissionTimeStamp: new Date().toISOString(),
    softwareInfo: agtSigningService.construirSoftwareInfo(),
    numberOfEntries: documentos.length,
    documents: documentos,
  };
}

module.exports = { construirDocumento, envelope, totaisDeLinhas, arredondarPorExcesso, calcularContribuicao };
