// tests/agt-sandbox-client.test.js
// agtSandboxClient — as 3 assinaturas JWS exigidas pela Sandbox REST da AGT
// e os 4 endpoints (registarFactura/obterEstado/consultarFactura/
// listarFacturas). Mesmo molde de agt-payload.test.js: um par de chaves de
// teste é injetado em process.env ANTES de qualquer require, porque a
// configuração é lida uma única vez ao carregar o módulo. O caso "sem
// configuração" vive à parte (agt-sandbox-client-sem-configuracao.test.js).
//
// A rede é sempre mocada — nenhum teste aqui chama a Sandbox real.
const crypto = require('crypto');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
process.env.AGT_JWS_PRIVATE_KEY_BASE64 = Buffer.from(privateKey).toString('base64');
process.env.AGT_SOFTWARE_VALIDATION_NUMBER = 'FE/00/2026/AGT-TESTE';
process.env.AGT_SOFTWARE_ID = 'KIXIMA-TESTE';
process.env.AGT_SOFTWARE_VERSION = '9.9.9';
process.env.AGT_SANDBOX_USERNAME = 'ws.hml.kixima';
process.env.AGT_SANDBOX_PASSWORD = 'segredo-teste';

const agtSandboxClient = require('../src/services/agtSandboxClient');

function base64urlParaBuffer(s) {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

// Verifica um JWS compacto contra a chave pública de teste e devolve o
// cabeçalho e o conteúdo (texto bruto, não descodificado como JSON — os
// testes decidem se fazem JSON.parse ou comparam a string tal como está).
function verificarJWS(jws) {
  const [h, p, s] = jws.split('.');
  const ok = crypto.verify('RSA-SHA256', Buffer.from(`${h}.${p}`, 'utf8'), publicKey, base64urlParaBuffer(s));
  return { ok, header: JSON.parse(base64urlParaBuffer(h).toString('utf8')), payloadTexto: base64urlParaBuffer(p).toString('utf8') };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('estado()/disponivel() com configuração completa', () => {
  test('disponivel() é verdadeiro e estado() reflete isso', () => {
    expect(agtSandboxClient.disponivel()).toBe(true);
    expect(agtSandboxClient.emFalta()).toEqual([]);
    expect(agtSandboxClient.estado()).toMatchObject({ canal: 'AGT_SANDBOX', disponivel: true });
  });
});

describe('assinarSoftware() — jwsSoftwareSignature sobre o OBJETO softwareInfoDetail', () => {
  test('assina exatamente productId/productVersion/softwareValidationNumber, verificável com a chave pública', () => {
    const { softwareInfoDetail, jwsSoftwareSignature } = agtSandboxClient.assinarSoftware();
    expect(softwareInfoDetail).toEqual({
      productId: 'KIXIMA-TESTE', productVersion: '9.9.9', softwareValidationNumber: 'FE/00/2026/AGT-TESTE',
    });

    const { ok, header, payloadTexto } = verificarJWS(jwsSoftwareSignature);
    expect(ok).toBe(true);
    expect(header).toEqual({ typ: 'JOSE', alg: 'RS256' });
    expect(JSON.parse(payloadTexto)).toEqual(softwareInfoDetail);
  });
});

describe('assinarDocumento() — jwsDocumentSignature sobre a STRING pipe-delimited', () => {
  test('concatena os 8 campos por "|", nesta ordem, e assina o texto (não JSON)', () => {
    const dados = {
      documentNo: 'FT 2026/1', taxRegistrationNumber: 'AO5417000000', documentType: 'FT',
      documentDate: '2026-09-11', customerTaxID: '999999999', customerCountry: 'AO',
      companyName: 'Cliente Teste, Lda', documentTotals: { taxPayable: 14, netTotal: 100, grossTotal: 114 },
    };
    const jws = agtSandboxClient.assinarDocumento(dados);
    const { ok, header, payloadTexto } = verificarJWS(jws);

    expect(ok).toBe(true);
    expect(header).toEqual({ typ: 'JOSE', alg: 'RS256' });
    expect(payloadTexto).toBe(
      'FT 2026/1|AO5417000000|FT|2026-09-11|999999999|AO|Cliente Teste, Lda|{"taxPayable":14,"netTotal":100,"grossTotal":114}',
    );
  });
});

describe('assinarSolicitacao() — jwsSignature sobre taxRegistrationNumber|submissionUUID', () => {
  test('concatena os 2 campos por "|" e assina o texto', () => {
    const jws = agtSandboxClient.assinarSolicitacao({ taxRegistrationNumber: 'AO5417000000', submissionUUID: 'uuid-123' });
    const { ok, payloadTexto } = verificarJWS(jws);
    expect(ok).toBe(true);
    expect(payloadTexto).toBe('AO5417000000|uuid-123');
  });
});

describe('Endpoints da Sandbox — cabeçalhos, rota e tratamento de resultCode', () => {
  function mockFetch(status, corpo) {
    return jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => corpo,
    });
  }

  test('registarFactura(): POST com corpo JSON e Authorization Basic corretos — sucesso real da AGT (sem resultCode, só requestID + errorList vazio)', async () => {
    // Resposta real confirmada em produção: NÃO traz `resultCode` nenhum
    // quando aceita — só `requestID` e `errorList` vazio. Ver o comentário em
    // agtSandboxClient.registarFactura().
    const RESPOSTA_REAL_AGT = { requestID: '202500000010689', errorList: [] };
    const fetchMock = mockFetch(200, RESPOSTA_REAL_AGT);
    const documento = { documentNo: 'FT 2026/1' };

    const resposta = await agtSandboxClient.registarFactura(documento);
    expect(resposta).toEqual(RESPOSTA_REAL_AGT);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opcoes] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://sifphml.minfin.gov.ao/sigt/fe/v1/registarFactura');
    expect(opcoes.method).toBe('POST');
    expect(opcoes.body).toBe(JSON.stringify(documento));
    expect(opcoes.headers.Authorization).toBe(`Basic ${Buffer.from('ws.hml.kixima:segredo-teste').toString('base64')}`);
    expect(opcoes.headers['Content-Type']).toBe('application/json');
  });

  test('registarFactura(): errorList com um elemento vazio ("[\'\']") não é recusa quando há requestID — mesma inconsistência já vista em seriesFEResult', async () => {
    const RESPOSTA_REAL_AGT = { requestID: '202500000010700', errorList: [''] };
    mockFetch(200, RESPOSTA_REAL_AGT);
    await expect(agtSandboxClient.registarFactura({})).resolves.toEqual(RESPOSTA_REAL_AGT);
  });

  test('registarFactura(): recusa expõe a resposta bruta completa da AGT em respostaBruta', async () => {
    const RESPOSTA_REAL_AGT = { errorList: [{ code: 'E001', message: 'NIF inválido' }] };
    mockFetch(200, RESPOSTA_REAL_AGT);
    await expect(agtSandboxClient.registarFactura({})).rejects.toMatchObject({
      name: 'AgtApiError',
      respostaBruta: RESPOSTA_REAL_AGT,
    });
  });

  test('solicitarSerie(): POST com corpo JSON e Authorization Basic corretos — sucesso real da AGT (resultCode=1 + seriesFEResult)', async () => {
    // Resposta real confirmada em HML: resultCode=1 (NÃO "0") mesmo quando a
    // AGT aceita — o sinal de sucesso é seriesFEResult.seriesCode, não o
    // resultCode. Ver o comentário em agtSandboxClient.solicitarSerie().
    const RESPOSTA_REAL_AGT = {
      resultCode: 1,
      errorList: [''],
      seriesFEResult: {
        seriesCode: 'LD6325S2042N', authorizedQuantity: '999999999999', firstDocumentNo: '1', lastDocumentNo: '999999999999',
      },
    };
    const fetchMock = mockFetch(200, RESPOSTA_REAL_AGT);
    const documento = { taxRegistrationNumber: 'AO5417000000', seriesYear: 2026, documentType: 'FT' };

    const resposta = await agtSandboxClient.solicitarSerie(documento);
    expect(resposta).toEqual(RESPOSTA_REAL_AGT);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opcoes] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://sifphml.minfin.gov.ao/sigt/fe/v1/solicitarSerie');
    expect(opcoes.method).toBe('POST');
    expect(opcoes.body).toBe(JSON.stringify(documento));
    expect(opcoes.headers.Authorization).toBe(`Basic ${Buffer.from('ws.hml.kixima:segredo-teste').toString('base64')}`);
  });

  test('solicitarSerie(): sem seriesFEResult.seriesCode é recusa, mesmo com resultCode "0"', async () => {
    // resultCode não é o sinal de sucesso para este endpoint (ver acima) —
    // sem seriesFEResult.seriesCode, é sempre tratado como recusa, mesmo que
    // a AGT mande um resultCode "0" que noutros endpoints seria sucesso.
    mockFetch(200, { resultCode: '0', errorList: [{ code: 'E099', message: 'estabelecimento não registado' }] });

    await expect(agtSandboxClient.solicitarSerie({})).rejects.toMatchObject({
      name: 'AgtApiError',
      resultCode: '0',
      errorList: [{ code: 'E099', message: 'estabelecimento não registado' }],
    });
  });

  test('obterEstado(): POST com o envelope tal como recebido (transporte puro, não constrói nada)', async () => {
    // CORRIGIDO: não é GET+query — um 405 real confirmou que é POST com um
    // envelope assinado (ver agtPayloadService.construirPedidoEstado()).
    const fetchMock = mockFetch(200, { resultCode: '0', status: 'PROCESSADO' });
    const envelope = { schemaVersion: '2.0', taxRegistrationNumber: 'AO5417000000', invoiceNo: 'FT SERIE/1' };

    await agtSandboxClient.obterEstado(envelope);

    const [url, opcoes] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://sifphml.minfin.gov.ao/sigt/fe/v1/obterEstado');
    expect(opcoes.method).toBe('POST');
    expect(opcoes.body).toBe(JSON.stringify(envelope));
  });

  test('consultarFactura(): GET com documentNo/taxRegistrationNumber na query', async () => {
    const fetchMock = mockFetch(200, { resultCode: '0' });
    await agtSandboxClient.consultarFactura({ documentNo: 'FT 2026/1', taxRegistrationNumber: 'AO5417000000' });

    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      'https://sifphml.minfin.gov.ao/sigt/fe/v1/consultarFactura?documentNo=FT+2026%2F1&taxRegistrationNumber=AO5417000000',
    );
  });

  test('listarFacturas(): omite da query os parâmetros não fornecidos', async () => {
    const fetchMock = mockFetch(200, { resultCode: '0', items: [] });
    await agtSandboxClient.listarFacturas({ taxRegistrationNumber: 'AO5417000000' });

    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://sifphml.minfin.gov.ao/sigt/fe/v1/listarFacturas?taxRegistrationNumber=AO5417000000');
  });

  test('registarFactura(): errorList preenchida é sempre recusa, mesmo com requestID presente', async () => {
    mockFetch(200, { requestID: '202500000010690', resultCode: '1', errorList: [{ code: 'E001', message: 'NIF inválido' }] });

    await expect(agtSandboxClient.registarFactura({})).rejects.toMatchObject({
      name: 'AgtApiError',
      resultCode: '1',
      errorList: [{ code: 'E001', message: 'NIF inválido' }],
    });
  });

  test('registarFactura(): sem requestID é sempre recusa, mesmo com errorList vazio', async () => {
    mockFetch(200, { errorList: [] });
    await expect(agtSandboxClient.registarFactura({})).rejects.toMatchObject({ name: 'AgtApiError' });
  });

  test('resultCode numérico 0 (não string) é tratado como sucesso — endpoint sem sinal próprio (consultarFactura)', async () => {
    mockFetch(200, { resultCode: 0, documentNo: 'FT 2026/2' });
    await expect(agtSandboxClient.consultarFactura({ documentNo: 'FT 2026/2' })).resolves.toEqual({ resultCode: 0, documentNo: 'FT 2026/2' });
  });

  test('HTTP não-2xx sem corpo JSON válido lança AgtApiError com o status como resultCode', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => { throw new Error('sem corpo'); },
    });

    await expect(agtSandboxClient.registarFactura({})).rejects.toMatchObject({
      name: 'AgtApiError', resultCode: '503',
    });
  });
});
