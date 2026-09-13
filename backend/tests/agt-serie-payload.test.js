// tests/agt-serie-payload.test.js
// GET /api/faturacao/agt-serie-payload — "Solicitar Série" (AGT DS.120, 4.5).
// Só gera e assina o pedido (agtSeriesService.js); não há cliente de rede.
//
// Mesmo cuidado de agt-payload.test.js: a configuração (chave privada RSA) é
// lida UMA VEZ ao carregar agtSigningService.js, por isso o par de chaves de
// teste é injetado em process.env ANTES de qualquer require dos serviços.
const crypto = require('crypto');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
process.env.AGT_JWS_PRIVATE_KEY_BASE64 = Buffer.from(privateKey).toString('base64');
process.env.AGT_SOFTWARE_VALIDATION_NUMBER = 'FE/00/2025/AGT-TESTE';

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
let fornecedorId;
let fornecedorTaxId;

beforeAll(async () => {
  tokens = await loginAll();
  const forn = await prisma.user.findUnique({ where: { email: 'fornecedor@kianda.co.ao' } });
  fornecedorId = forn.companyId;
  const empresa = await prisma.company.findUnique({ where: { id: fornecedorId } });
  fornecedorTaxId = empresa.taxId;
});

afterAll(async () => {
  await prisma.$disconnect();
});

function pedir(token, params) {
  return auth(token).get('/api/faturacao/agt-serie-payload').query(params);
}

const PARAMS_VALIDOS = {
  supplierCompanyId: null, // preenchido em cada teste com fornecedorId
  ano: '2026',
  tipoDocumento: 'FT',
  numeroEstabelecimento: '1',
};

describe('GET /api/faturacao/agt-serie-payload — RBAC', () => {
  test('só o Admin do Sistema pode pedir — Fornecedor é recusado', async () => {
    const res = await pedir(tokens.fornecedor, { ...PARAMS_VALIDOS, supplierCompanyId: fornecedorId });
    expect(res.status).toBe(403);
  });

  test('Comprador é recusado', async () => {
    const res = await pedir(tokens.comprador, { ...PARAMS_VALIDOS, supplierCompanyId: fornecedorId });
    expect(res.status).toBe(403);
  });

  test('sem sessão é recusado', async () => {
    const res = await request(app).get('/api/faturacao/agt-serie-payload').query({ ...PARAMS_VALIDOS, supplierCompanyId: fornecedorId });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/faturacao/agt-serie-payload — validação', () => {
  test('sem supplierCompanyId', async () => {
    const res = await pedir(tokens.adminSistema, { ...PARAMS_VALIDOS, supplierCompanyId: undefined });
    expect(res.status).toBe(422);
  });

  test('empresa fornecedora inexistente devolve 404', async () => {
    const res = await pedir(tokens.adminSistema, { ...PARAMS_VALIDOS, supplierCompanyId: 'nao-existe-123' });
    expect(res.status).toBe(404);
  });

  test('sem ano', async () => {
    const res = await pedir(tokens.adminSistema, { ...PARAMS_VALIDOS, supplierCompanyId: fornecedorId, ano: undefined });
    expect(res.status).toBe(422);
  });

  test('ano não numérico', async () => {
    const res = await pedir(tokens.adminSistema, { ...PARAMS_VALIDOS, supplierCompanyId: fornecedorId, ano: 'abc' });
    expect(res.status).toBe(422);
  });

  test('sem tipoDocumento', async () => {
    const res = await pedir(tokens.adminSistema, { ...PARAMS_VALIDOS, supplierCompanyId: fornecedorId, tipoDocumento: undefined });
    expect(res.status).toBe(422);
  });

  test('sem numeroEstabelecimento', async () => {
    const res = await pedir(tokens.adminSistema, { ...PARAMS_VALIDOS, supplierCompanyId: fornecedorId, numeroEstabelecimento: undefined });
    expect(res.status).toBe(422);
  });

  test('indicadorContingencia inválido é recusado', async () => {
    const res = await pedir(tokens.adminSistema, {
      ...PARAMS_VALIDOS, supplierCompanyId: fornecedorId, indicadorContingencia: 'X',
    });
    expect(res.status).toBe(422);
  });
});

describe('GET /api/faturacao/agt-serie-payload — sucesso', () => {
  test('gera o pedido com o NIF certo, assinado, e indicadorContingencia por omissão "N"', async () => {
    const res = await pedir(tokens.adminSistema, { ...PARAMS_VALIDOS, supplierCompanyId: fornecedorId });
    expect(res.status).toBe(200);
    expect(res.body.taxRegistrationNumber).toBe(fornecedorTaxId);
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
      taxRegistrationNumber: fornecedorTaxId,
      seriesYear: 2026,
      documentType: 'FT',
      establishmentNumber: '1',
      seriesContingencyIndicator: 'N',
    });
  });

  test('aceita indicadorContingencia "C" e tipoDocumento em minúsculas (normaliza para maiúsculas)', async () => {
    const res = await pedir(tokens.adminSistema, {
      ...PARAMS_VALIDOS, supplierCompanyId: fornecedorId, tipoDocumento: 'nc', indicadorContingencia: 'C',
    });
    expect(res.status).toBe(200);
    expect(res.body.documentType).toBe('NC');
    expect(res.body.seriesContingencyIndicator).toBe('C');
  });

  test('duas chamadas para a mesma empresa geram submissionUUID diferentes (não há reaproveitamento acidental)', async () => {
    const r1 = await pedir(tokens.adminSistema, { ...PARAMS_VALIDOS, supplierCompanyId: fornecedorId });
    const r2 = await pedir(tokens.adminSistema, { ...PARAMS_VALIDOS, supplierCompanyId: fornecedorId });
    expect(r1.body.submissionUUID).not.toBe(r2.body.submissionUUID);
  });
});
