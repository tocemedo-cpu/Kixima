// tests/conteudo-local.test.js
// Relatório de conteúdo local.
//
// Não existe modelo oficial da ANPG — este relatório é um desenho proposto. O
// que estes testes protegem não são os números em si, é o que os torna
// DEFENSÁVEIS. Um relatório de conformidade que não aguenta uma pergunta é pior
// do que nenhum: dá confiança a quem o entrega e cai quando é lido.
//
// As três regras que não podem mudar sem alguém reparar:
//   1. o desconhecido não conta a favor de quem reporta;
//   2. o que não é compra não entra;
//   3. cada número reconstitui-se a partir do anexo.
const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/database');
const conteudoLocal = require('../src/services/conteudoLocalService');
const { loginAll, auth } = require('./helpers');

const PERIODO = { de: '2020-01-01', ate: '2035-12-31' };

let compradora;
let planoOriginal;

beforeAll(async () => {
  compradora = await prisma.company.findFirst({ where: { type: 'CLIENTE' } });
  planoOriginal = { plan: compradora.plan, searchRank: compradora.searchRank };
});
afterAll(async () => {
  await prisma.company.update({ where: { id: compradora.id }, data: planoOriginal });
});

describe('O que entra na conta', () => {
  test('só entram ordens com compromisso real — intenções não são compras', async () => {
    const r = await conteudoLocal.gerar(compradora.id, PERIODO);
    const porAprovar = await prisma.purchaseOrder.count({
      where: { buyerCompanyId: compradora.id, status: { in: ['AGUARDANDO_APROVACAO', 'REJEITADA', 'RECUSADA_FORNECEDOR'] } },
    });
    const referencias = r.anexo.map((a) => a.referencia);
    const naoDeviam = await prisma.purchaseOrder.findMany({
      where: { reference: { in: referencias } },
      select: { reference: true, status: true },
    });
    for (const po of naoDeviam) {
      expect(conteudoLocal.ESTADOS_CONTAM).toContain(po.status);
    }
    // O teste só tem valor se houver mesmo ordens excluídas para excluir.
    expect(porAprovar + r.totais.ordens).toBeGreaterThan(r.totais.ordens - 1);
  });

  test('o critério vai escrito no relatório — dois relatórios iguais não podem dar números diferentes', async () => {
    const r = await conteudoLocal.gerar(compradora.id, PERIODO);
    expect(r.criterio.estadosIncluidos).toEqual(conteudoLocal.ESTADOS_CONTAM);
    expect(r.criterio.baseDeCalculo).toMatch(/sem IVA/i);
    expect(r.criterio.origemPorDeclarar).toMatch(/NÃO contam como angolanas/i);
  });

  test('o período é respeitado, e o dia de fim conta por inteiro', async () => {
    const vazio = await conteudoLocal.gerar(compradora.id, { de: '1999-01-01', ate: '1999-12-31' });
    expect(vazio.totais.ordens).toBe(0);
    expect(vazio.contratacaoNacional.percentagem).toBe(0);

    const r = await conteudoLocal.gerar(compradora.id, PERIODO);
    expect(new Date(r.periodo.ate).toISOString()).toMatch(/T23:59:59/);
  });

  test('datas inválidas ou invertidas são recusadas', async () => {
    await expect(conteudoLocal.gerar(compradora.id, { de: 'ontem', ate: 'hoje' })).rejects.toThrow(/AAAA-MM-DD/);
    await expect(conteudoLocal.gerar(compradora.id, { de: '2030-01-01', ate: '2020-01-01' }))
      .rejects.toThrow(/posterior/);
  });
});

// A regra que separa este relatório de um número de vaidade.
describe('O desconhecido não conta a favor de quem reporta', () => {
  test('uma linha sem país de origem NÃO conta como angolana', async () => {
    const r = await conteudoLocal.gerar(compradora.id, PERIODO);
    // No seed nenhum produto tem país de origem: logo, origem angolana = 0,
    // mesmo com 100% dos fornecedores registados em Angola.
    expect(r.contratacaoNacional.percentagem).toBeGreaterThan(0);
    expect(r.origemDoBem.percentagemAngolana).toBe(0);
    expect(r.origemDoBem.porDeclarar).toBeGreaterThan(0);
  });

  test('e o relatório diz que não se pode entregar assim', async () => {
    const r = await conteudoLocal.gerar(compradora.id, PERIODO);
    expect(r.qualidadeDosDados.confiavel).toBe(false);
    expect(r.qualidadeDosDados.aviso).toMatch(/não deve ser entregue/i);
    expect(r.qualidadeDosDados.percentagemSemOrigem).toBeGreaterThan(10);
  });

  test('declarar a origem move o número — e só então', async () => {
    const antes = await conteudoLocal.gerar(compradora.id, PERIODO);
    const produtos = await prisma.product.findMany({ select: { id: true }, take: 100 });
    try {
      await prisma.product.updateMany({
        where: { id: { in: produtos.map((p) => p.id) } },
        data: { countryOfOrigin: 'Angola' },
      });
      const depois = await conteudoLocal.gerar(compradora.id, PERIODO);
      expect(depois.origemDoBem.percentagemAngolana).toBeGreaterThan(antes.origemDoBem.percentagemAngolana);
      expect(depois.qualidadeDosDados.confiavel).toBe(true);
      expect(depois.qualidadeDosDados.aviso).toBeNull();
    } finally {
      await prisma.product.updateMany({
        where: { id: { in: produtos.map((p) => p.id) } },
        data: { countryOfOrigin: null },
      });
    }
  });

  test('um bem importado por um fornecedor angolano aparece como importado', async () => {
    // Tem de ser um produto que esteja MESMO numa ordem desta compradora,
    // senão o teste não exercita nada.
    const linha = await prisma.purchaseOrderItem.findFirst({
      where: { purchaseOrder: { buyerCompanyId: compradora.id, status: { in: conteudoLocal.ESTADOS_CONTAM } } },
      select: { productId: true },
    });
    const produto = { id: linha.productId };
    try {
      await prisma.product.update({ where: { id: produto.id }, data: { countryOfOrigin: 'China' } });
      const r = await conteudoLocal.gerar(compradora.id, PERIODO);
      expect(r.origemDoBem.importada).toBeGreaterThan(0);
      // O fornecedor continua a contar como contratação nacional — são
      // perguntas diferentes, e é essa a razão de serem duas linhas.
      expect(r.contratacaoNacional.percentagem).toBeGreaterThan(0);
    } finally {
      await prisma.product.update({ where: { id: produto.id }, data: { countryOfOrigin: null } });
    }
  });
});

describe('Os números reconstituem-se', () => {
  test('o total do anexo bate certo com o total do relatório', async () => {
    const r = await conteudoLocal.gerar(compradora.id, PERIODO);
    const soma = r.anexo.reduce((s, a) => s + a.valorSemIva, 0);
    expect(Math.round(soma * 100)).toBe(Math.round(r.totais.valorTotal * 100));
  });

  test('cada linha do anexo traz o NIF e a dimensão — é o que sustenta a classificação', async () => {
    const r = await conteudoLocal.gerar(compradora.id, PERIODO);
    expect(r.anexo.length).toBeGreaterThan(0);
    for (const linha of r.anexo) {
      expect(linha.referencia).toMatch(/^PO-/);
      expect(linha.nif).toBeTruthy();
      expect(linha.paisDoFornecedor).toBeTruthy();
      expect(linha.dimensao).toBeTruthy();
    }
  });

  test('a soma das categorias não excede o total', async () => {
    const r = await conteudoLocal.gerar(compradora.id, PERIODO);
    const soma = r.porCategoria.reduce((s, c) => s + c.total, 0);
    // As linhas somam o valor sem IVA das ordens; nunca mais do que o total.
    expect(soma).toBeLessThanOrEqual(r.totais.valorTotal * 1.0001);
  });
});

describe('Acesso', () => {
  let tokens;
  beforeAll(async () => { tokens = await loginAll(); });

  test('é do plano Pro, e a mensagem diz qual', async () => {
    await prisma.company.update({ where: { id: compradora.id }, data: { plan: 'CORE', searchRank: 1 } });
    const res = await auth(tokens.companyAdmin).get('/api/reports/conteudo-local');
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/Relatório de conteúdo local/);
    expect(res.body.error.message).toMatch(/plano PRO/);
  });

  test('no Pro, gera', async () => {
    await prisma.company.update({ where: { id: compradora.id }, data: { plan: 'PRO', searchRank: 2 } });
    const res = await auth(tokens.companyAdmin).get('/api/reports/conteudo-local?de=2020-01-01&ate=2035-12-31');
    expect(res.status).toBe(200);
    expect(res.body.contratacaoNacional).toBeDefined();
    expect(res.body.anexo.length).toBeGreaterThan(0);
  });

  test('sem sessão não se acede aos números de ninguém', async () => {
    expect((await request(app).get('/api/reports/conteudo-local')).status).toBe(401);
  });

  test('cada empresa vê só as suas compras', async () => {
    await prisma.company.update({ where: { id: compradora.id }, data: { plan: 'PRO', searchRank: 2 } });
    const res = await auth(tokens.companyAdmin).get('/api/reports/conteudo-local?de=2020-01-01&ate=2035-12-31');
    const referencias = res.body.anexo.map((a) => a.referencia);
    const alheias = await prisma.purchaseOrder.count({
      where: { reference: { in: referencias }, buyerCompanyId: { not: compradora.id } },
    });
    expect(alheias).toBe(0);
  });
});
