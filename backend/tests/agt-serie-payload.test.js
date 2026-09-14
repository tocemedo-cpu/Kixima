// tests/agt-serie-payload.test.js
// GET /api/faturacao/agt-serie-payload — "Solicitar Série" (AGT DS.120, 4.5).
// Só gera e assina o pedido (agtSeriesService.js); não há cliente de rede.
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

const { request, app, auth, prisma, loginAll } = require('./helpers');

function base64urlParaBuffer(s) {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function verificarJWS(jws) {
  const [h, p, s] = jws.split('.');
  const ok = crypto.verify('RSA-SHA256', Buffer.from(`${h}.${p}`, 'utf8'), publicKey, base64urlParaBuffer(s));
  return { ok, payload: JSON.parse(base64urlParaBuffer(p).toString('utf8')) };
}

let tokens;

beforeAll(async () => {
  tokens = await loginAll();
});

afterAll(async () => {
  await prisma.$disconnect();
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

describe('GET /api/faturacao/agt-serie-payload — sucesso', () => {
  test('gera o pedido com o NIF do ambiente (AGT_NIF), assinado, estabelecimento "1" e indicador "N"', async () => {
    const res = await pedir(tokens.adminSistema, PARAMS_VALIDOS);
    expect(res.status).toBe(200);
    expect(res.body.taxRegistrationNumber).toBe('5001636863');
    expect(res.body.seriesYear).toBe(2026);
    expect(res.body.documentType).toBe('FT');
    expect(res.body.establishmentNumber).toBe('1');
    expect(res.body.seriesContingencyIndicator).toBe('N');
    expect(typeof res.body.submissionUUID).toBe('string');
    expect(res.body.submissionUUID.length).toBeGreaterThan(0);
    expect(res.body.softwareInfo?.softwareInfoDetail).toBeTruthy();

    const { ok, payload } = verificarJWS(res.body.jwsSignature);
    expect(ok).toBe(true);
    expect(payload).toEqual({
      taxRegistrationNumber: '5001636863',
      seriesYear: 2026,
      documentType: 'FT',
      establishmentNumber: '1',
      seriesContingencyIndicator: 'N',
    });
  });

  test('tipoDocumento em minúsculas é normalizado para maiúsculas', async () => {
    const res = await pedir(tokens.adminSistema, { ...PARAMS_VALIDOS, tipoDocumento: 'nc' });
    expect(res.status).toBe(200);
    expect(res.body.documentType).toBe('NC');
  });

  test('duas chamadas seguidas geram submissionUUID diferentes (não há reaproveitamento acidental)', async () => {
    const r1 = await pedir(tokens.adminSistema, PARAMS_VALIDOS);
    const r2 = await pedir(tokens.adminSistema, PARAMS_VALIDOS);
    expect(r1.body.submissionUUID).not.toBe(r2.body.submissionUUID);
  });
});
