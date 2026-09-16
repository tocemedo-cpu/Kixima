// tests/agt-series-fe.test.js
// GET /api/faturacao/agt-series-fe — histórico dos pedidos "Solicitar Série"
// já ACEITES pela AGT (tabela agtseriesfe), gravados por
// agtSeriesService.solicitarSerie() — ver agt-serie-payload.test.js para
// quem grava; este ficheiro cobre só a rota de listagem.
const { request, app, auth, prisma, loginAll } = require('./helpers');

let tokens;

beforeAll(async () => {
  tokens = await loginAll();
});

afterAll(async () => {
  await prisma.$disconnect();
});

function listar(token) {
  return auth(token).get('/api/faturacao/agt-series-fe');
}

describe('GET /api/faturacao/agt-series-fe — RBAC', () => {
  test('só o Admin do Sistema pode ver — Fornecedor é recusado', async () => {
    const res = await listar(tokens.fornecedor);
    expect(res.status).toBe(403);
  });

  test('Comprador é recusado', async () => {
    const res = await listar(tokens.comprador);
    expect(res.status).toBe(403);
  });

  test('sem sessão é recusado', async () => {
    const res = await request(app).get('/api/faturacao/agt-series-fe');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/faturacao/agt-series-fe — listagem', () => {
  test('devolve as linhas gravadas, mais recente primeiro', async () => {
    await prisma.agtSeriesFe.deleteMany({});
    await prisma.agtSeriesFe.create({
      data: {
        ano: 2025, tipoDocumento: 'NC', establishmentNumber: '1', taxRegistrationNumber: '5001636863',
        seriesCode: 'NC-2025-01', submissionUUID: 'uuid-mais-antigo', resultCode: '0',
      },
    });
    // createdAt tem default now() — força uma diferença de tempo determinística
    // em vez de confiar em dois `new Date()` consecutivos poderem colidir.
    await new Promise((r) => { setTimeout(r, 10); });
    await prisma.agtSeriesFe.create({
      data: {
        ano: 2026, tipoDocumento: 'FT', establishmentNumber: '1', taxRegistrationNumber: '5001636863',
        seriesCode: 'FT-2026-01', submissionUUID: 'uuid-mais-recente', resultCode: '0',
      },
    });

    const res = await listar(tokens.adminSistema);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    expect(res.body[0].submissionUUID).toBe('uuid-mais-recente');
    expect(res.body[1].submissionUUID).toBe('uuid-mais-antigo');
    expect(res.body[0].seriesCode).toBe('FT-2026-01');
  });

  test('sem nenhum pedido gravado, devolve uma lista vazia', async () => {
    await prisma.agtSeriesFe.deleteMany({});
    const res = await listar(tokens.adminSistema);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
