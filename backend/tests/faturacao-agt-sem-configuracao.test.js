// tests/faturacao-agt-sem-configuracao.test.js
// GET /api/faturacao/agt-payload/:tipo/:id e GET /api/faturacao/agt-serie-payload
// quando a assinatura AGT NÃO está configurada neste ambiente (o estado real
// hoje — ver agtSigningService.js). Antes disto, o pedido rebentava dentro do
// serviço com um Error genérico e o errorHandler devolvia um 500 sem
// contexto nenhum; agora a rota verifica agtSigningService.disponivel()
// antes de tentar assinar e devolve 503 com uma mensagem clara.
//
// Deliberadamente NÃO injeta AGT_JWS_PRIVATE_KEY_BASE64/AGT_SOFTWARE_VALIDATION_NUMBER
// em process.env — é o estado por omissão dos testes (ver tests/env.js).
// Também esconde src/chave/chavePrivada.pem enquanto corre (ver
// ./_ocultarChavePrivadaAgt) — sem isso, uma chave real posta ali
// manualmente tornaria este ficheiro incapaz de testar o estado "sem
// configuração".
const { oculta, restaurar } = require('./_ocultarChavePrivadaAgt');

const chaveEstavaPresente = oculta();

const { auth, prisma, loginAll } = require('./helpers');

let tokens;

beforeAll(async () => {
  tokens = await loginAll();
});

afterAll(async () => {
  restaurar(chaveEstavaPresente);
  await prisma.$disconnect();
});

describe('GET /api/faturacao/agt-payload/:tipo/:id sem assinatura AGT configurada', () => {
  test('devolve 503 com mensagem clara, não um 500 genérico', async () => {
    const res = await auth(tokens.fornecedor).get('/api/faturacao/agt-payload/FT/qualquer-id');
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICO_INDISPONIVEL');
    expect(res.body.error.message).toMatch(/assinatura AGT ainda não está configurada/);
  });
});

describe('GET /api/faturacao/agt-serie-payload sem assinatura AGT configurada', () => {
  test('devolve 503 com mensagem clara, não um 500 genérico', async () => {
    const res = await auth(tokens.adminSistema).get('/api/faturacao/agt-serie-payload').query({ ano: '2026', tipoDocumento: 'FT' });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICO_INDISPONIVEL');
    expect(res.body.error.message).toMatch(/assinatura AGT ainda não está configurada/);
  });

  test('a verificação de configuração vem antes da validação dos parâmetros — 503, não 422, mesmo sem nenhum parâmetro', async () => {
    const res = await auth(tokens.adminSistema).get('/api/faturacao/agt-serie-payload');
    expect(res.status).toBe(503);
  });
});
