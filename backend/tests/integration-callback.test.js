// tests/integration-callback.test.js
// Regressão do callback de integração ERP: sem KIXIMA_CALLBACK_SECRET
// configurado, o endpoint falha fechado (não aceita callbacks não assinados).
const { request, app, prisma } = require('./helpers');

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Callback de integração ERP (falha fechada)', () => {
  test('sem segredo configurado, recusa o callback (503)', async () => {
    // No ambiente de teste, KIXIMA_CALLBACK_SECRET não está definido.
    const res = await request(app)
      .post('/api/integration/callback')
      .send({ type: 'erp.sync.completed', data: { ok: true } });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('CALLBACK_NOT_CONFIGURED');
  });
});
