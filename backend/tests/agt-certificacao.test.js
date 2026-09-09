// tests/agt-certificacao.test.js
// agtCertificacaoService.js gera documentos AGT SINTÉTICOS (não ligados a
// nenhuma Invoice/CreditNote/Payment) para os casos de teste de
// certificação/homologação da AGT (ver scripts/agt-certificacao-c1-fr.js).
// Aqui testa-se só a matemática e a estrutura — a chave de teste é injetada
// tal como em agt-payload.test.js.
const crypto = require('crypto');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
process.env.AGT_JWS_PRIVATE_KEY_BASE64 = Buffer.from(privateKey).toString('base64');
process.env.AGT_SOFTWARE_VALIDATION_NUMBER = 'FE/00/2025/AGT-CERT-TESTE';

const agtCertificacaoService = require('../src/services/agtCertificacaoService');

function base64urlParaBuffer(s) {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}
function verificarJWS(jws) {
  const [h, p, s] = jws.split('.');
  const ok = crypto.verify('RSA-SHA256', Buffer.from(`${h}.${p}`, 'utf8'), publicKey, base64urlParaBuffer(s));
  return { ok, payload: JSON.parse(base64urlParaBuffer(p).toString('utf8')) };
}

describe('arredondarPorExcesso — regra da spec (DS.120, 4.1.6, taxContribution)', () => {
  test.each([
    [23.144, 23.15],
    [0.001844, 0.01],
    [5.9999999, 6],
    [0, 0],
    [126, 126], // valor já exato ao cêntimo não deve ganhar um cêntimo extra
  ])('%f -> %f', (entrada, esperado) => {
    expect(agtCertificacaoService.arredondarPorExcesso(entrada)).toBe(esperado);
  });
});

describe('totaisDeLinhas', () => {
  test('soma taxContribution de todas as linhas/impostos e netTotal de credit/debitAmount', () => {
    const linhas = [
      { creditAmount: 1000, debitAmount: 0, taxes: [{ taxContribution: 140 }] },
      { creditAmount: 0, debitAmount: 500, taxes: [{ taxContribution: 70 }, { taxContribution: 5 }] },
    ];
    expect(agtCertificacaoService.totaisDeLinhas(linhas)).toEqual({ taxPayable: 215, netTotal: 1500, grossTotal: 1715 });
  });

  test('linha sem taxes (array vazio ou ausente) conta como imposto zero', () => {
    expect(agtCertificacaoService.totaisDeLinhas([{ creditAmount: 100, taxes: [] }])).toEqual({ taxPayable: 0, netTotal: 100, grossTotal: 100 });
  });
});

describe('construirDocumento', () => {
  const linhas = [{ lineNumber: 1, creditAmount: 1000, debitAmount: 0, taxes: [{ taxType: 'IVA', taxCode: 'NOR', taxPercentage: 14, taxContribution: 140 }] }];

  test('jwsDocumentSignature verifica e inclui documentTotals (8 campos, spec oficial)', () => {
    const doc = agtCertificacaoService.construirDocumento({
      documentType: 'FR', documentNo: 'FR TESTE.2026/0000001', taxRegistrationNumber: '5001636863', documentDate: '2026-01-01',
      cliente: { taxId: '999999999', country: 'AO', name: 'Cliente Teste' }, linhas,
    });
    expect(doc.documentTotals).toEqual({ taxPayable: 140, netTotal: 1000, grossTotal: 1140 });
    const { ok, payload } = verificarJWS(doc.jwsDocumentSignature);
    expect(ok).toBe(true);
    expect(payload).toEqual({
      documentNo: doc.documentNo, taxRegistrationNumber: '5001636863', documentType: 'FR', documentDate: '2026-01-01',
      customerTaxID: '999999999', customerCountry: 'AO', companyName: 'Cliente Teste', documentTotals: doc.documentTotals,
    });
  });

  test('cliente sem taxId (estrangeiro ou doméstico sem NIF) usa o placeholder "999999999" que a AGT documenta — o validador real rejeita o campo em falta mesmo para estrangeiros', () => {
    const doc = agtCertificacaoService.construirDocumento({
      documentType: 'FR', documentNo: 'FR TESTE.2026/0000002', taxRegistrationNumber: '5001636863', documentDate: '2026-01-01',
      cliente: { country: 'PT', name: 'Cliente Estrangeiro' }, linhas,
    });
    expect(doc.customerTaxID).toBe('999999999');
    const { payload } = verificarJWS(doc.jwsDocumentSignature);
    expect(payload.customerTaxID).toBe('999999999');
  });
});

describe('envelope', () => {
  test('agrupa vários documentos num único submissionUUID, numberOfEntries correto', () => {
    const doc = agtCertificacaoService.construirDocumento({
      documentType: 'FR', documentNo: 'FR TESTE.2026/0000003', taxRegistrationNumber: '5001636863', documentDate: '2026-01-01',
      cliente: { taxId: '999999999', country: 'AO', name: 'Cliente Teste' }, linhas: [],
    });
    const payload = agtCertificacaoService.envelope('5001636863', [doc, doc]);
    expect(payload.schemaVersion).toBe('1.2');
    expect(payload.numberOfEntries).toBe(2);
    expect(payload.documents).toHaveLength(2);
    expect(payload.submissionUUID).toMatch(/^[0-9a-f-]{36}$/);
    const { ok } = verificarJWS(payload.softwareInfo.jwsSoftwareSignature);
    expect(ok).toBe(true);
  });
});
