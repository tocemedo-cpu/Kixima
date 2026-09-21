// tests/agt-serie-sem-estabelecimento.test.js
// GET /api/faturacao/agt-serie-payload quando a Sandbox e o AGT_NIF estão
// configurados mas falta AGT_ESTABLISHMENT_NUMBER — o código do
// estabelecimento registado na AGT para esse NIF (ver config/env.js).
//
// Existe porque um valor fixo no código ("1", nunca confirmado junto da
// AGT) causou em produção: "E99 — O estabelecimento com o código 1 não se
// encontra registado para o contribuinte identificado pelo NIF ...".
// establishmentNumber passou a vir só de AGT_ESTABLISHMENT_NUMBER — sem essa
// variável, a rota recusa-se a gerar o pedido, em vez de assumir um valor.
//
// Vive à parte de agt-serie-payload.test.js (esse injeta
// AGT_ESTABLISHMENT_NUMBER antes de qualquer require) porque a configuração
// é lida UMA VEZ ao carregar os módulos — não há como alternar dentro do
// mesmo ficheiro.
const crypto = require('crypto');

const { privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
process.env.AGT_JWS_PRIVATE_KEY_BASE64 = Buffer.from(privateKey).toString('base64');
process.env.AGT_SOFTWARE_VALIDATION_NUMBER = 'FE/00/2025/AGT-TESTE';
process.env.AGT_SANDBOX_USERNAME = 'ws.hml.teste';
process.env.AGT_SANDBOX_PASSWORD = 'senha-teste';
process.env.AGT_NIF = '5001636863';
delete process.env.AGT_ESTABLISHMENT_NUMBER;

const { auth, prisma, loginAll } = require('./helpers');

let tokens;

beforeAll(async () => {
  tokens = await loginAll();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/faturacao/agt-serie-payload sem AGT_ESTABLISHMENT_NUMBER configurado', () => {
  test('devolve 503 com mensagem clara sobre o estabelecimento, não um pedido com um código adivinhado', async () => {
    const res = await auth(tokens.adminSistema).get('/api/faturacao/agt-serie-payload').query({ ano: '2026', tipoDocumento: 'FT' });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICO_INDISPONIVEL');
    expect(res.body.error.message).toMatch(/AGT_ESTABLISHMENT_NUMBER/);
  });
});
