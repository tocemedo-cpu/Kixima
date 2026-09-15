// tests/agt-serie-payload.test.js
// GET /api/faturacao/agt-serie-payload — "Solicitar Série" (AGT DS.120, 4.5).
// Constrói e assina o pedido (agtSeriesService.construirPedidoSerie), depois
// SUBMETE-O mesmo à AGT via agtSeriesService.solicitarSerie(), que reaproveita
// agtSandboxClient.js como transporte — mockado aqui (não há rede real nos
// testes; agtSandboxClient.js já tem os seus próprios testes de transporte).
//
// Pedido simplificado a pedido do utilizador: só ano + tipoDocumento entram
// pelo ecrã — o NIF vem de AGT_NIF (a mesma identidade fiscal da conta de
// homologação/produção usada em AGT_SANDBOX_USERNAME/PASSWORD, ver
// config/env.js), e o estabelecimento/indicador de contingência são sempre
// "1"/"N" (únicos valores usados neste ambiente).
//
// Mesmo cuidado de agt-payload.test.js: a configuração (chave privada RSA,
// AGT_NIF) é lida UMA VEZ ao carregar os módulos, por isso é injetada em
// process.env ANTES de qualquer require dos serviços.
const crypto = require('crypto');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
process.env.AGT_JWS_PRIVATE_KEY_BASE64 = Buffer.from(privateKey).toString('base64');
process.env.AGT_SOFTWARE_VALIDATION_NUMBER = 'FE/00/2025/AGT-TESTE';
process.env.AGT_NIF = '5001636863';
process.env.AGT_SANDBOX_USERNAME = 'ws.hml.teste';
process.env.AGT_SANDBOX_PASSWORD = 'senha-teste';

jest.mock('../src/services/agtSandboxClient');

const agtSandboxClient = require('../src/services/agtSandboxClient');
const { request, app, auth, prisma, loginAll } = require('./helpers');

function base64urlParaBuffer(s) {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function verificarJWS(jws) {
  const [h, p, s] = jws.split('.');
  const ok = crypto.verify('RSA-SHA256', Buffer.from(`${h}.${p}`, 'utf8'), publicKey, base64urlParaBuffer(s));
  return { ok, payload: JSON.parse(base64urlParaBuffer(p).toString('utf8')) };
}

const RESPOSTA_AGT = { resultCode: '0', requestID: 'REQ-TESTE-123' };

let tokens;

beforeAll(async () => {
  tokens = await loginAll();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(() => {
  agtSandboxClient.disponivel.mockReturnValue(true);
  agtSandboxClient.emFalta.mockReturnValue([]);
  agtSandboxClient.solicitarSerie.mockResolvedValue(RESPOSTA_AGT);
});

function pedir(token, params) {
  return auth(token).get('/api/faturacao/agt-serie-payload').query(params);
}

const PARAMS_VALIDOS = { ano: '2026', tipoDocumento: 'FT' };

describe('GET /api/faturacao/agt-serie-payload — RBAC', () => {
  test('só o Admin do Sistema pode pedir — Fornecedor é recusado', async () => {
    const res = await pedir(tokens.fornecedor, PARAMS_VALIDOS);
    expect(res.status).toBe(403);
  });

  test('Comprador é recusado', async () => {
    const res = await pedir(tokens.comprador, PARAMS_VALIDOS);
    expect(res.status).toBe(403);
  });

  test('sem sessão é recusado', async () => {
    const res = await request(app).get('/api/faturacao/agt-serie-payload').query(PARAMS_VALIDOS);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/faturacao/agt-serie-payload — validação', () => {
  test('sem ano', async () => {
    const res = await pedir(tokens.adminSistema, { ...PARAMS_VALIDOS, ano: undefined });
    expect(res.status).toBe(422);
  });

  test('ano não numérico', async () => {
    const res = await pedir(tokens.adminSistema, { ...PARAMS_VALIDOS, ano: 'abc' });
    expect(res.status).toBe(422);
  });

  test('sem tipoDocumento', async () => {
    const res = await pedir(tokens.adminSistema, { ...PARAMS_VALIDOS, tipoDocumento: undefined });
    expect(res.status).toBe(422);
  });
});

describe('GET /api/faturacao/agt-serie-payload — configuração da Sandbox em falta', () => {
  test('sem credenciais da Sandbox, devolve 503 com o que falta (não um 500 genérico)', async () => {
    agtSandboxClient.disponivel.mockReturnValue(false);
    agtSandboxClient.emFalta.mockReturnValue(['AGT_SANDBOX_USERNAME', 'AGT_SANDBOX_PASSWORD']);

    const res = await pedir(tokens.adminSistema, PARAMS_VALIDOS);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICO_INDISPONIVEL');
    expect(agtSandboxClient.solicitarSerie).not.toHaveBeenCalled();
  });
});

describe('GET /api/faturacao/agt-serie-payload — sucesso', () => {
  test('constrói o pedido com o NIF do ambiente (AGT_NIF), assinado, estabelecimento "1" e indicador "N", e submete-o à AGT', async () => {
    const res = await pedir(tokens.adminSistema, PARAMS_VALIDOS);
    expect(res.status).toBe(200);

    const { pedido, resposta } = res.body;
    expect(pedido.taxRegistrationNumber).toBe('5001636863');
    expect(pedido.seriesYear).toBe(2026);
    expect(pedido.documentType).toBe('FT');
    expect(pedido.establishmentNumber).toBe('1');
    expect(pedido.seriesContingencyIndicator).toBe('N');
    expect(typeof pedido.submissionUUID).toBe('string');
    expect(pedido.submissionUUID.length).toBeGreaterThan(0);
    expect(pedido.softwareInfo?.softwareInfoDetail).toBeTruthy();

    const { ok, payload } = verificarJWS(pedido.jwsSignature);
    expect(ok).toBe(true);
    expect(payload).toEqual({
      taxRegistrationNumber: '5001636863',
      seriesYear: 2026,
      documentType: 'FT',
      establishmentNumber: '1',
      seriesContingencyIndicator: 'N',
    });

    expect(resposta).toEqual(RESPOSTA_AGT);
    expect(agtSandboxClient.solicitarSerie).toHaveBeenCalledTimes(1);
    expect(agtSandboxClient.solicitarSerie).toHaveBeenCalledWith(pedido);
  });

  test('tipoDocumento em minúsculas é normalizado para maiúsculas', async () => {
    const res = await pedir(tokens.adminSistema, { ...PARAMS_VALIDOS, tipoDocumento: 'nc' });
    expect(res.status).toBe(200);
    expect(res.body.pedido.documentType).toBe('NC');
  });

  test('duas chamadas seguidas geram submissionUUID diferentes (não há reaproveitamento acidental)', async () => {
    const r1 = await pedir(tokens.adminSistema, PARAMS_VALIDOS);
    const r2 = await pedir(tokens.adminSistema, PARAMS_VALIDOS);
    expect(r1.body.pedido.submissionUUID).not.toBe(r2.body.pedido.submissionUUID);
  });
});

describe('GET /api/faturacao/agt-serie-payload — recusa da AGT', () => {
  test('quando a AGT recusa o pedido (resultCode != "0"), devolve 502 com o motivo (não um 500 genérico)', async () => {
    // jest.mock() automocka a classe (instanceof continua a funcionar, mas o
    // construtor mockado não corre a lógica real que atribui os campos) — por
    // isso atribuem-se aqui explicitamente, tal como agtSeriesService.js os lê.
    const erro = new agtSandboxClient.AgtApiError('solicitarSerie', '1', [{ code: 'E001', message: 'NIF inválido para esta série.' }]);
    erro.endpoint = 'solicitarSerie';
    erro.resultCode = '1';
    erro.errorList = [{ code: 'E001', message: 'NIF inválido para esta série.' }];
    erro.message = 'A AGT recusou o pedido de série.';
    agtSandboxClient.solicitarSerie.mockRejectedValue(erro);

    const res = await pedir(tokens.adminSistema, PARAMS_VALIDOS);
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('AGT_RECUSOU');
    expect(res.body.error.details?.resultCode).toBe('1');
    expect(res.body.error.details?.errorList).toEqual([{ code: 'E001', message: 'NIF inválido para esta série.' }]);
  });
});
