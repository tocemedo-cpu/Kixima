// tests/public-stats.test.js
// GET /api/public/stats — os números reais que a home corporativa mostra em
// vez de texto de marketing fixo. Sem autenticação, de propósito: é
// informação que qualquer visitante da homepage já vê antes de ter conta.
const { request, app, prisma } = require('./helpers');
const config = require('../src/config/env');

afterAll(async () => { await prisma.$disconnect(); });

describe('GET /api/public/stats', () => {
  test('responde sem autenticação, com as 4 contagens', async () => {
    const res = await request(app).get('/api/public/stats');
    expect(res.status).toBe(200);
    expect(typeof res.body.empresasVerificadas).toBe('number');
    expect(typeof res.body.fornecedoresQualificados).toBe('number');
    expect(typeof res.body.ordensProcessadas).toBe('number');
    expect(res.body.pagamentoSlaDias).toBe(config.business.paymentSlaDays);
  });

  test('conta reflete o que está realmente na base — nunca inventado', async () => {
    const [empresasAprovadas, fornecedoresAprovados] = await Promise.all([
      prisma.company.count({ where: { status: 'APROVADA' } }),
      prisma.company.count({ where: { status: 'APROVADA', type: 'FORNECEDOR' } }),
    ]);
    const res = await request(app).get('/api/public/stats');
    expect(res.body.empresasVerificadas).toBe(empresasAprovadas);
    expect(res.body.fornecedoresQualificados).toBe(fornecedoresAprovados);
    // O total de fornecedores nunca pode exceder o total de empresas.
    expect(res.body.fornecedoresQualificados).toBeLessThanOrEqual(res.body.empresasVerificadas);
  });
});
