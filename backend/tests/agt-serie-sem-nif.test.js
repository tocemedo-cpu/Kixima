// tests/agt-serie-sem-nif.test.js
// GET /api/faturacao/agt-serie-payload quando a assinatura AGT está
// configurada mas falta AGT_NIF — o NIF da conta de homologação/produção
// (ver config/env.js). Vive à parte de faturacao-agt-sem-configuracao.test.js
// (esse cobre a assinatura em falta) e de agt-serie-payload.test.js (esse
// injeta AGT_NIF antes de qualquer require) porque a configuração é lida UMA
// VEZ ao carregar os módulos — não há como alternar dentro do mesmo ficheiro.
const crypto = require('crypto');

const { privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
process.env.AGT_JWS_PRIVATE_KEY_BASE64 = Buffer.from(privateKey).toString('base64');
process.env.AGT_SOFTWARE_VALIDATION_NUMBER = 'FE/00/2025/AGT-TESTE';
// A rota agora exige a configuração da Sandbox (agtSandboxClient.js, superset
// da assinatura — ver exigirSandboxAgtConfigurada() em faturacaoRoutes.js)
// antes mesmo de chegar à verificação do NIF. Sem isto, o teste apanhava o
// 503 errado (Sandbox em falta) em vez do 503 sobre o AGT_NIF que quer testar.
process.env.AGT_SANDBOX_USERNAME = 'ws.hml.teste';
process.env.AGT_SANDBOX_PASSWORD = 'senha-teste';
delete process.env.AGT_NIF;

const { auth, prisma, loginAll } = require('./helpers');

let tokens;

beforeAll(async () => {
  tokens = await loginAll();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/faturacao/agt-serie-payload sem AGT_NIF configurado', () => {
  test('devolve 503 com mensagem clara sobre o NIF, não um pedido com NIF vazio', async () => {
    const res = await auth(tokens.adminSistema).get('/api/faturacao/agt-serie-payload').query({ ano: '2026', tipoDocumento: 'FT' });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICO_INDISPONIVEL');
    expect(res.body.error.message).toMatch(/AGT_NIF/);
  });
});
