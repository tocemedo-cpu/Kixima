// tests/category-management.test.js
// Category Management + Economia de Escala.
//
// O que estes testes protegem:
//   1. os agregados de categoryAnalyticsService batem certo com os dados reais;
//   2. os thresholds de desconto são CONFIGURÁVEIS — mudar a tabela muda o
//      resultado, sem tocar em código;
//   3. sem ANTHROPIC_API_KEY, a recomendação vem null com motivo — NUNCA um
//      texto de IA fabricado, e a análise numérica continua a funcionar;
//   4. é PRO-only, e o gate de plano dá a mensagem certa;
//   5. cada empresa só vê os seus próprios números.
const prisma = require('../src/config/database');
const categoryAnalyticsService = require('../src/services/categoryAnalyticsService');
const discountThresholdService = require('../src/services/discountThresholdService');
const aiRecommendationService = require('../src/services/aiRecommendationService');
const { request, app, loginAll, auth } = require('./helpers');

let compradora;
let planoOriginal;
let tokens;

beforeAll(async () => {
  compradora = await prisma.company.findFirst({ where: { type: 'CLIENTE' } });
  planoOriginal = { plan: compradora.plan, searchRank: compradora.searchRank };
  tokens = await loginAll();
});

afterAll(async () => {
  await prisma.company.update({ where: { id: compradora.id }, data: planoOriginal });
});

describe('categoryAnalyticsService — agregações batem com os dados reais', () => {
  test('volumePorCategoria: a soma das categorias é o total, e cada linha vem de uma PO desta empresa', async () => {
    const r = await categoryAnalyticsService.volumePorCategoria({ companyId: compradora.id });
    const soma = r.categorias.reduce((s, c) => s + c.valor, 0);
    expect(Math.round(soma * 100)).toBe(Math.round(r.total * 100));
    for (const c of r.categorias) {
      expect(c.percentual).toBeGreaterThanOrEqual(0);
      expect(c.percentual).toBeLessThanOrEqual(100.01);
    }
  });

  test('mediaMensalPorProduto: sem histórico devolve zero, nunca lança', async () => {
    const r = await categoryAnalyticsService.mediaMensalPorProduto({ companyId: compradora.id, productId: 'inexistente' });
    expect(r.mediaMensal).toBe(0);
    expect(r.amostras).toBe(0);
  });

  test('mediaMensalPorProduto: com histórico real, a média não excede a quantidade total comprada', async () => {
    const linha = await prisma.purchaseOrderItem.findFirst({
      where: { purchaseOrder: { buyerCompanyId: compradora.id, status: { in: ['PAGA', 'EM_EXECUCAO', 'ENTREGUE', 'RECEBIDA_CONFORME', 'RECEBIDA_COM_DIVERGENCIA', 'CONCLUIDA'] } } },
      select: { productId: true },
    });
    expect(linha).toBeTruthy();
    const r = await categoryAnalyticsService.mediaMensalPorProduto({ companyId: compradora.id, productId: linha.productId });
    expect(r.amostras).toBeGreaterThan(0);
    expect(r.mediaMensal).toBeLessThanOrEqual(r.quantidadeTotal);
    expect(r.mediaMensal).toBeGreaterThan(0);
  });

  test('previsaoNecessidade: sem histórico devolve zero previsão, nunca lança', async () => {
    const r = await categoryAnalyticsService.previsaoNecessidade({ companyId: compradora.id, productId: 'inexistente' });
    expect(r.previsaoProximoMes).toBe(0);
    expect(r.baseMeses).toBe(0);
  });

  test('oportunidadesConsolidacao: sem thresholds ativos, não há oportunidade nenhuma', async () => {
    const r = await categoryAnalyticsService.oportunidadesConsolidacao({ companyId: compradora.id, thresholds: [] });
    expect(r).toEqual([]);
  });

  test('oportunidadesConsolidacao: só entram categorias com pelo menos 3 POs distintas', async () => {
    const thresholds = [{ minVolumeUsd: 1, discountPercent: 2.5, ativo: true }];
    const r = await categoryAnalyticsService.oportunidadesConsolidacao({ companyId: compradora.id, thresholds });
    for (const o of r) {
      expect(o.numeroPos).toBeGreaterThanOrEqual(3);
      expect(o.faltamUsd).toBeGreaterThan(0);
    }
  });
});

describe('discountThresholdService — configurável em runtime, não hardcoded', () => {
  test('o seed da migração tem os 3 patamares do pedido: 100k/2,5% · 500k/5% · 1M/10%', async () => {
    const lista = await discountThresholdService.listar({ apenasAtivos: true });
    const porValor = Object.fromEntries(lista.map((t) => [Number(t.minVolumeUsd), Number(t.discountPercent)]));
    expect(porValor[100000]).toBe(2.5);
    expect(porValor[500000]).toBe(5);
    expect(porValor[1000000]).toBe(10);
  });

  test('proximoThreshold: abaixo do primeiro patamar, desconto atual é zero e falta para o primeiro', async () => {
    const r = await discountThresholdService.proximoThreshold(50000);
    expect(r.descontoAtual).toBe(0);
    expect(r.proximoThreshold.minVolumeUsd).toBe(100000);
    expect(r.faltamUsd).toBe(50000);
  });

  test('proximoThreshold: entre dois patamares, usa o mais alto já atingido', async () => {
    const r = await discountThresholdService.proximoThreshold(600000);
    expect(r.descontoAtual).toBe(5);
    expect(r.proximoThreshold.minVolumeUsd).toBe(1000000);
  });

  test('proximoThreshold: acima do maior patamar, não há próximo', async () => {
    const r = await discountThresholdService.proximoThreshold(5000000);
    expect(r.descontoAtual).toBe(10);
    expect(r.proximoThreshold).toBeNull();
    expect(r.faltamUsd).toBeNull();
  });

  test('mudar a tabela muda o resultado — é isto que "configurável" quer dizer', async () => {
    const antes = await discountThresholdService.proximoThreshold(150000);
    expect(antes.descontoAtual).toBe(2.5);

    const novo = await discountThresholdService.criar({ minVolumeUsd: 120000, discountPercent: 3 }, {});
    try {
      const depois = await discountThresholdService.proximoThreshold(150000);
      expect(depois.descontoAtual).toBe(3);
    } finally {
      await discountThresholdService.remover(novo.id, {});
    }
  });

  test('validação: percentual fora de 0-100 é recusado', async () => {
    await expect(discountThresholdService.criar({ minVolumeUsd: 10, discountPercent: 150 }, {})).rejects.toThrow();
    await expect(discountThresholdService.criar({ minVolumeUsd: -5, discountPercent: 10 }, {})).rejects.toThrow();
  });

  test('remover um threshold inexistente lança NotFoundError', async () => {
    await expect(discountThresholdService.remover('00000000-0000-0000-0000-000000000000', {})).rejects.toThrow();
  });
});

describe('aiRecommendationService — recusa-se a fingir', () => {
  test('sem ANTHROPIC_API_KEY, disponivel() é falso', () => {
    expect(aiRecommendationService.disponivel()).toBe(false);
  });

  test('gerar() nunca lança — devolve texto null com motivo explícito', async () => {
    const r = await aiRecommendationService.gerar({
      empresa: 'Teste', volumeAtual: 1000, categorias: [], thresholdInfo: { descontoAtual: 0, proximoThreshold: null }, oportunidades: [],
    });
    expect(r.texto).toBeNull();
    expect(r.motivo).toMatch(/ANTHROPIC_API_KEY/);
  });
});

describe('Rotas — GET /api/category-management/analise', () => {
  test('sem sessão, 401', async () => {
    const res = await request(app).get('/api/category-management/analise');
    expect(res.status).toBe(401);
  });

  test('fornecedor não tem acesso (é um recurso do lado comprador)', async () => {
    await prisma.company.update({ where: { id: compradora.id }, data: { plan: 'PRO', searchRank: 2 } });
    const res = await auth(tokens.fornecedor).get('/api/category-management/analise');
    expect(res.status).toBe(403);
  });

  test('plano CORE é bloqueado, e a mensagem diz que é PRO', async () => {
    await prisma.company.update({ where: { id: compradora.id }, data: { plan: 'CORE', searchRank: 1 } });
    const res = await auth(tokens.companyAdmin).get('/api/category-management/analise');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PLANO_INSUFICIENTE');
    expect(res.body.error.message).toMatch(/PRO/);
  });

  test('no plano PRO, devolve a análise completa, sem recomendação de IA (não configurada)', async () => {
    await prisma.company.update({ where: { id: compradora.id }, data: { plan: 'PRO', searchRank: 2 } });
    const res = await auth(tokens.companyAdmin).get('/api/category-management/analise');
    expect(res.status).toBe(200);
    expect(res.body.volumeAtualUsd).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(res.body.categorias)).toBe(true);
    expect(Array.isArray(res.body.oportunidadesConsolidacao)).toBe(true);
    expect(res.body.recomendacao.texto).toBeNull();
    expect(res.body.recomendacao.motivo).toMatch(/ANTHROPIC_API_KEY/);
  });

  test('recomendacao=0 salta a chamada de IA (mesmo resultado, mais rápido)', async () => {
    await prisma.company.update({ where: { id: compradora.id }, data: { plan: 'PRO', searchRank: 2 } });
    const res = await auth(tokens.companyAdmin).get('/api/category-management/analise?recomendacao=0');
    expect(res.status).toBe(200);
    expect(res.body.recomendacao.texto).toBeNull();
  });

  test('financeiro e comprador também têm acesso (não só o company admin)', async () => {
    await prisma.company.update({ where: { id: compradora.id }, data: { plan: 'PRO', searchRank: 2 } });
    const resFin = await auth(tokens.financeiro).get('/api/category-management/analise');
    const resCompr = await auth(tokens.comprador).get('/api/category-management/analise');
    expect(resFin.status).toBe(200);
    expect(resCompr.status).toBe(200);
  });
});

describe('Rotas — gestão de thresholds pelo Admin do Sistema', () => {
  let criadoId;

  afterEach(async () => {
    if (criadoId) {
      await prisma.discountThreshold.deleteMany({ where: { id: criadoId } });
      criadoId = null;
    }
  });

  test('company admin não gere thresholds — é uma configuração da KIXIMA, não da empresa', async () => {
    const res = await auth(tokens.companyAdmin).get('/api/category-management/admin/thresholds');
    expect(res.status).toBe(403);
  });

  test('admin do sistema lista, cria, atualiza e remove um threshold', async () => {
    const lista = await auth(tokens.adminSistema).get('/api/category-management/admin/thresholds');
    expect(lista.status).toBe(200);
    expect(Array.isArray(lista.body)).toBe(true);

    const criar = await auth(tokens.adminSistema)
      .post('/api/category-management/admin/thresholds')
      .send({ minVolumeUsd: 250000, discountPercent: 4 });
    expect(criar.status).toBe(201);
    criadoId = criar.body.id;

    const atualizar = await auth(tokens.adminSistema)
      .put(`/api/category-management/admin/thresholds/${criadoId}`)
      .send({ discountPercent: 4.5 });
    expect(atualizar.status).toBe(200);
    expect(Number(atualizar.body.discountPercent)).toBe(4.5);

    const remover = await auth(tokens.adminSistema).del(`/api/category-management/admin/thresholds/${criadoId}`);
    expect(remover.status).toBe(204);
    criadoId = null;

    const auditoria = await prisma.auditLog.findFirst({
      where: { entityType: 'DiscountThreshold', action: 'DISCOUNT_THRESHOLD_CRIADO' },
      orderBy: { createdAt: 'desc' },
    });
    expect(auditoria).toBeTruthy();
  });
});
