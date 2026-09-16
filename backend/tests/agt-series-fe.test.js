// tests/agt-series-fe.test.js
// GET /api/faturacao/agt-series-fe — histórico dos pedidos "Solicitar Série"
// já ACEITES pela AGT (tabela agtseriesfe), gravados por
// agtSeriesService.solicitarSerie() — ver agt-serie-payload.test.js para
// quem grava. Cobre também GET /api/faturacao/agt-serie/:tipo — a série
// ATUALMENTE atribuída para um tipo de documento (só consulta o mesmo
// histórico, não gera nem submete nada).
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

function obterPorTipo(token, tipo, query) {
  return auth(token).get(`/api/faturacao/agt-serie/${tipo}`).query(query);
}

describe('GET /api/faturacao/agt-serie/:tipo — RBAC', () => {
  test('só o Admin do Sistema pode consultar — Fornecedor é recusado', async () => {
    const res = await obterPorTipo(tokens.fornecedor, 'FT');
    expect(res.status).toBe(403);
  });

  test('sem sessão é recusado', async () => {
    const res = await request(app).get('/api/faturacao/agt-serie/FT');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/faturacao/agt-serie/:tipo — consulta', () => {
  const ANO_ATUAL = new Date().getFullYear();

  beforeEach(async () => {
    await prisma.agtSeriesFe.deleteMany({});
  });

  test('devolve a série mais recente para o tipo/ano/estabelecimento pedidos', async () => {
    await prisma.agtSeriesFe.create({
      data: {
        ano: ANO_ATUAL, tipoDocumento: 'FT', establishmentNumber: '1', taxRegistrationNumber: '5001636863',
        seriesCode: 'FT-ANTIGA', submissionUUID: 'uuid-ft-antiga', resultCode: '1',
      },
    });
    await new Promise((r) => { setTimeout(r, 10); });
    await prisma.agtSeriesFe.create({
      data: {
        ano: ANO_ATUAL, tipoDocumento: 'FT', establishmentNumber: '1', taxRegistrationNumber: '5001636863',
        seriesCode: 'FT-RECENTE', submissionUUID: 'uuid-ft-recente', resultCode: '1',
      },
    });
    // Outro tipo, não deve interferir na consulta por "FT".
    await prisma.agtSeriesFe.create({
      data: {
        ano: ANO_ATUAL, tipoDocumento: 'NC', establishmentNumber: '1', taxRegistrationNumber: '5001636863',
        seriesCode: 'NC-QUALQUER', submissionUUID: 'uuid-nc', resultCode: '1',
      },
    });

    const res = await obterPorTipo(tokens.adminSistema, 'FT', { establishmentNumber: '1' });
    expect(res.status).toBe(200);
    expect(res.body.seriesCode).toBe('FT-RECENTE');
  });

  test('tipo em minúsculas é normalizado para maiúsculas', async () => {
    await prisma.agtSeriesFe.create({
      data: {
        ano: ANO_ATUAL, tipoDocumento: 'NC', establishmentNumber: '1', taxRegistrationNumber: '5001636863',
        seriesCode: 'NC-2026-01', submissionUUID: 'uuid-nc-minusculo', resultCode: '1',
      },
    });

    const res = await obterPorTipo(tokens.adminSistema, 'nc', { establishmentNumber: '1' });
    expect(res.status).toBe(200);
    expect(res.body.seriesCode).toBe('NC-2026-01');
  });

  test('ano por omissão é o ano em curso — um pedido de outro ano não conta', async () => {
    await prisma.agtSeriesFe.create({
      data: {
        ano: ANO_ATUAL - 1, tipoDocumento: 'FT', establishmentNumber: '1', taxRegistrationNumber: '5001636863',
        seriesCode: 'FT-ANO-PASSADO', submissionUUID: 'uuid-ano-passado', resultCode: '1',
      },
    });

    const res = await obterPorTipo(tokens.adminSistema, 'FT', { establishmentNumber: '1' });
    expect(res.status).toBe(404);
  });

  test('sem nenhum pedido aceite para o tipo, devolve 404 (nunca uma série inventada)', async () => {
    const res = await obterPorTipo(tokens.adminSistema, 'RC', { establishmentNumber: '1' });
    expect(res.status).toBe(404);
  });
});
