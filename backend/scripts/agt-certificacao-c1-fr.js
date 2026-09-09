// scripts/agt-certificacao-c1-fr.js
// Gera o payload de submissão AGT para o caso de teste C1 (Factura/Recibo)
// da certificação/homologação — um único envio com um documento FR por
// cenário: comprador em Angola, comprador em Cabinda, estrangeiro com NIF,
// estrangeiro sem NIF, e um documento sujeito a cativação (retenção na
// fonte). Cobre também os 3 sistemas de imposto que o C1 pede (IVA, IEC,
// IS), usando só valores das tabelas oficiais da spec (DS.120, anexos 9.1,
// 9.6, 9.7) — nada inventado.
//
// ATENÇÃO — dados por preencher antes de submeter à AGT:
// - AGT_JWS_PRIVATE_KEY_BASE64 / AGT_SOFTWARE_VALIDATION_NUMBER: têm de ser
//   os REAIS do ambiente de homologação (aqui usa-se um par de teste gerado
//   na hora, só para o JSON ter uma assinatura válida estruturalmente).
// - taxRegistrationNumber (NIF emissor): por preencher com o NIF real
//   registado para a conta de homologação da KIXIMA.
//
// Uso: node scripts/agt-certificacao-c1-fr.js [ficheiro-de-saída.json]
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TAX_REGISTRATION_NUMBER = process.env.AGT_HOMOLOGACAO_NIF || 'SUBSTITUIR-PELO-NIF-REAL-DE-HOMOLOGACAO';

if (!process.env.AGT_JWS_PRIVATE_KEY_BASE64) {
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  process.env.AGT_JWS_PRIVATE_KEY_BASE64 = Buffer.from(privateKey).toString('base64');
  console.error('[aviso] AGT_JWS_PRIVATE_KEY_BASE64 não estava definida — gerada uma chave de TESTE só para este ficheiro ficar assinado estruturalmente. Substituir pela chave real de homologação antes de submeter.');
}
if (!process.env.AGT_SOFTWARE_VALIDATION_NUMBER) {
  process.env.AGT_SOFTWARE_VALIDATION_NUMBER = 'SUBSTITUIR-PELO-SOFTWAREVALIDATIONNUMBER-DE-HOMOLOGACAO';
}

const agtCertificacaoService = require('../src/services/agtCertificacaoService');

const HOJE = new Date().toISOString().slice(0, 10);
const IVA_NOR = 14; // taxService.IVA_RATE — a única taxa de IVA normal que a KIXIMA usa.
const IRT = 6.5; // taxService.WITHHOLDING_RATE — retenção de serviços já usada no resto da plataforma.

let contador = 0;
function proximoDocumentNo() {
  contador += 1;
  return `FR CERT-FR.${new Date().getFullYear()}/${String(contador).padStart(7, '0')}`;
}

function linhaIVA({ lineNumber, productCode, descricao, quantity, unitPrice, taxCode = 'NOR', taxPercentage = IVA_NOR, taxCountryRegion = 'AO', taxExemptionCode }) {
  const net = round2(quantity * unitPrice);
  const contribuicao = agtCertificacaoService.calcularContribuicao(net, taxPercentage);
  const taxa = { taxType: 'IVA', taxCountryRegion, taxCode, taxPercentage, taxContribution: contribuicao };
  if (taxExemptionCode) taxa.taxExemptionCode = taxExemptionCode;
  return {
    lineNumber, productCode, productDescription: descricao, quantity, unitOfMeasure: 'UN',
    unitPrice, unitPriceBase: unitPrice, debitAmount: 0, creditAmount: net,
    taxes: [taxa], settlementAmount: 0,
  };
}
function round2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }

// --- Documento 1: comprador em Angola (doméstico) — IVA normal + IEC ------
// IEC (Anexo 9.7): "2402.20.00 — Cigarros que contenham tabaco", 25%.
const doc1Linhas = [
  linhaIVA({ lineNumber: 1, productCode: 'PROD-AO-01', descricao: 'Produto nacional sujeito a IVA normal', quantity: 3, unitPrice: 300 }),
  (() => {
    const net = 500; // 10 kg a 50 Kz/kg
    const contribuicao = agtCertificacaoService.calcularContribuicao(net, 25);
    return {
      lineNumber: 2, productCode: '2402.20.00', productDescription: 'Cigarros que contenham tabaco (Anexo 9.7)',
      quantity: 10, unitOfMeasure: 'KILOGRAMA (Kg)', unitPrice: 50, unitPriceBase: 50,
      debitAmount: 0, creditAmount: net,
      taxes: [{ taxType: 'IEC', taxCountryRegion: 'AO', taxCode: '2402.20.00', taxPercentage: 25, taxContribution: contribuicao }],
      settlementAmount: 0,
    };
  })(),
];

// --- Documento 2: comprador em Cabinda -------------------------------------
// taxCountryRegion "AO-CAB" é o único valor documentado para Cabinda (spec
// 4.1.6); não há taxa de IVA diferenciada documentada nas tabelas
// fornecidas, por isso usa-se a mesma taxa normal (14%), só a região muda.
const doc2Linhas = [
  linhaIVA({ lineNumber: 1, productCode: 'PROD-CAB-01', descricao: 'Produto entregue em Cabinda', quantity: 5, unitPrice: 100, taxCountryRegion: 'AO-CAB' }),
];

// --- Documento 3: comprador estrangeiro, com NIF ---------------------------
// Exportação — isenta nos termos da alínea a) do artigo 15.º do CIVA (M30,
// Anexo 9.1): "transmissões de bens expedidos... com destino ao estrangeiro".
const doc3Linhas = [
  linhaIVA({ lineNumber: 1, productCode: 'PROD-EXP-01', descricao: 'Bem exportado para cliente com NIF estrangeiro', quantity: 4, unitPrice: 250, taxCode: 'ISE', taxPercentage: 0, taxExemptionCode: 'M30' }),
];

// --- Documento 4: comprador estrangeiro, sem NIF ---------------------------
// Mesma isenção de exportação. customerTaxID não é passado (cliente.taxId
// fica por preencher) — agtCertificacaoService.construirDocumento() cai
// então no placeholder "999999999" que a AGT documenta, confirmado
// obrigatório pelo validador real mesmo para comprador estrangeiro (a
// tabela da spec marcava-o "N" só para este caso; o validador não).
const doc4Linhas = [
  linhaIVA({ lineNumber: 1, productCode: 'PROD-EXP-02', descricao: 'Bem exportado para cliente estrangeiro sem NIF identificado', quantity: 2, unitPrice: 400, taxCode: 'ISE', taxPercentage: 0, taxExemptionCode: 'M30' }),
];

// --- Documento 5: sujeito a cativação (retenção na fonte) ------------------
// Serviço com IVA normal + Imposto de Selo verba 23.3 ("Recibo de quitação
// pelo efectivo recebimento de créditos... 1%", Anexo 9.6) — apropriado por
// ser precisamente o componente de "recibo" de uma fatura-recibo — e
// withholdingTaxList com IRT (6,5%, a mesma taxa já usada no resto da
// KIXIMA para retenção de serviços).
const doc5NetServico = 2000;
const doc5Linhas = [
  linhaIVA({ lineNumber: 1, productCode: 'SERV-01', descricao: 'Serviço prestado, sujeito a retenção na fonte', quantity: 1, unitPrice: doc5NetServico }),
  (() => {
    const contribuicao = agtCertificacaoService.calcularContribuicao(doc5NetServico, 1);
    return {
      lineNumber: 2, productCode: 'IS-23.3', productDescription: 'Imposto de Selo — verba 23.3 (recibo de quitação)',
      quantity: 1, unitOfMeasure: 'UN', unitPrice: 0, unitPriceBase: 0,
      debitAmount: 0, creditAmount: 0,
      taxes: [{ taxType: 'IS', taxCountryRegion: 'AO', taxCode: '23.3', taxPercentage: 1, taxContribution: contribuicao }],
      settlementAmount: 0,
    };
  })(),
];
const doc5Retencao = agtCertificacaoService.arredondarPorExcesso((doc5NetServico * IRT) / 100);

const documentos = [
  agtCertificacaoService.construirDocumento({
    documentType: 'FR', documentNo: proximoDocumentNo(), taxRegistrationNumber: TAX_REGISTRATION_NUMBER, documentDate: HOJE,
    cliente: { taxId: '5417896523', country: 'AO', name: 'Comprador Nacional Exemplo, Lda' },
    linhas: doc1Linhas,
  }),
  agtCertificacaoService.construirDocumento({
    documentType: 'FR', documentNo: proximoDocumentNo(), taxRegistrationNumber: TAX_REGISTRATION_NUMBER, documentDate: HOJE,
    cliente: { taxId: '5417896531', country: 'AO', name: 'Comprador Cabinda Exemplo, Lda' },
    linhas: doc2Linhas,
  }),
  agtCertificacaoService.construirDocumento({
    documentType: 'FR', documentNo: proximoDocumentNo(), taxRegistrationNumber: TAX_REGISTRATION_NUMBER, documentDate: HOJE,
    cliente: { taxId: '265432109', country: 'PT', name: 'Comprador Estrangeiro Com NIF, Lda' },
    linhas: doc3Linhas,
  }),
  agtCertificacaoService.construirDocumento({
    documentType: 'FR', documentNo: proximoDocumentNo(), taxRegistrationNumber: TAX_REGISTRATION_NUMBER, documentDate: HOJE,
    cliente: { country: 'PT', name: 'Comprador Estrangeiro Sem NIF, Lda' }, // taxId omitido de propósito
    linhas: doc4Linhas,
  }),
  agtCertificacaoService.construirDocumento({
    documentType: 'FR', documentNo: proximoDocumentNo(), taxRegistrationNumber: TAX_REGISTRATION_NUMBER, documentDate: HOJE,
    cliente: { taxId: '5417896548', country: 'AO', name: 'Comprador Sujeito a Cativação, Lda' },
    linhas: doc5Linhas,
    withholdingTaxList: [{ withholdingTaxType: 'IRT', withholdingTaxDescription: 'Retenção na fonte — Imposto Sobre os Rendimentos do Trabalho (6,5%)', withholdingTaxAmount: doc5Retencao }],
  }),
];

const payload = agtCertificacaoService.envelope(TAX_REGISTRATION_NUMBER, documentos);

const destino = process.argv[2] || path.join(__dirname, '..', 'agt-certificacao-c1-fr.json');
fs.writeFileSync(destino, JSON.stringify(payload, null, 2), 'utf8');
console.error(`Escrito: ${destino}`);
