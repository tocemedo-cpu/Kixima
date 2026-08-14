// tests/api-catalogo.test.js
// API de catálogo (plano Pro), autenticada por CHAVE.
//
// Uma chave de API contorna o login E a verificação em dois passos — um sistema
// não introduz um código de 6 dígitos. Não há como evitar isso; o que há é
// limitar o estrago, e é isso que estes testes protegem:
//
//   1. o ALCANCE é o catálogo da própria empresa, e nada mais;
//   2. a chave não existe em texto na base de dados;
//   3. mostra-se uma vez e revoga-se de imediato;
//   4. descer de plano tira o acesso — o Pro não se paga uma vez e fica;
//   5. o que a máquina altera deixa rasto igual ao que a pessoa altera.
const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/database');
const { loginAll, auth } = require('./helpers');

let tokens;
let fornecedora;
let planoOriginal;
let chave;
let chaveId;

const comChave = (k) => request(app).get('/api/v1/catalogo').set('Authorization', `Bearer ${k}`);

beforeAll(async () => {
  tokens = await loginAll();
  fornecedora = await prisma.company.findFirst({ where: { type: 'FORNECEDOR' } });
  planoOriginal = { plan: fornecedora.plan, searchRank: fornecedora.searchRank };
  await prisma.company.update({ where: { id: fornecedora.id }, data: { plan: 'PRO', searchRank: 2 } });

  const res = await auth(tokens.fornecedor).post('/api/catalog/api-keys').send({ nome: 'ERP de teste' });
  chave = res.body.chave;
  chaveId = res.body.id;
});

afterAll(async () => {
  await prisma.apiKey.deleteMany({ where: { companyId: fornecedora.id } });
  await prisma.company.update({ where: { id: fornecedora.id }, data: planoOriginal });
});

describe('A chave', () => {
  test('é do plano Pro', async () => {
    await prisma.company.update({ where: { id: fornecedora.id }, data: { plan: 'CORE', searchRank: 1 } });
    const res = await auth(tokens.fornecedor).post('/api/catalog/api-keys').send({ nome: 'Não devia dar' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/API de catálogo/);
    expect(res.body.error.message).toMatch(/plano PRO/);
    await prisma.company.update({ where: { id: fornecedora.id }, data: { plan: 'PRO', searchRank: 2 } });
  });

  test('mostra-se UMA vez, e nunca mais', async () => {
    const criada = await auth(tokens.fornecedor).post('/api/catalog/api-keys').send({ nome: 'Só uma vez' });
    expect(criada.body.chave).toMatch(/^kxm_[0-9a-f]{8}\./);
    expect(criada.body.aviso).toMatch(/não voltará a ser mostrada/i);

    // Nem a listagem nem a base de dados a devolvem.
    const lista = await auth(tokens.fornecedor).get('/api/catalog/api-keys');
    expect(JSON.stringify(lista.body)).not.toContain(criada.body.chave);

    await auth(tokens.fornecedor).del(`/api/catalog/api-keys/${criada.body.id}`);
  });

  // O ponto que impede uma fuga da base de dados de se tornar acesso ao catálogo.
  test('NÃO fica em texto na base de dados', async () => {
    const registos = await prisma.apiKey.findMany({ where: { companyId: fornecedora.id } });
    expect(registos.length).toBeGreaterThan(0);
    for (const r of registos) {
      expect(r.hash).not.toBe(chave);
      expect(r.hash).not.toContain(chave.split('.')[1]);
    }
  });

  test('exige um nome — é por ele que se sabe o que revogar', async () => {
    const res = await auth(tokens.fornecedor).post('/api/catalog/api-keys').send({ nome: '  ' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/nome/i);
  });
});

describe('O alcance da chave', () => {
  test('lê o catálogo da própria empresa', async () => {
    const res = await comChave(chave);
    expect(res.status).toBe(200);
    expect(res.body.itens.length).toBeGreaterThan(0);
    expect(res.body.total).toBeGreaterThan(0);
  });

  test('e SÓ o da própria empresa', async () => {
    const res = await comChave(chave);
    const skus = res.body.itens.map((i) => i.sku).filter(Boolean);
    const alheios = await prisma.product.count({
      where: { sku: { in: skus }, supplierId: { not: fornecedora.id } },
    });
    expect(alheios).toBe(0);
  });

  // O que a chave NÃO alcança é o que a torna segura.
  test('não chega a ordens, pagamentos nem utilizadores', async () => {
    for (const caminho of ['/api/purchase-orders', '/api/payments', '/api/users/profile', '/api/admin/prontidao']) {
      const res = await request(app).get(caminho).set('Authorization', `Bearer ${chave}`);
      // A chave não é um JWT: estas rotas recusam-na.
      expect(res.status).toBeGreaterThanOrEqual(401);
      expect(res.status).toBeLessThan(500);
    }
  });

  test('sem chave, não se lê nada', async () => {
    const res = await request(app).get('/api/v1/catalogo');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('SEM_CHAVE');
  });

  test('uma chave inventada não entra, e a mensagem não diz porquê', async () => {
    const res = await comChave('kxm_deadbeef.inventada');
    expect(res.status).toBe(401);
    // Uma só mensagem para todos os casos: dizer qual deles ajudaria quem tenta.
    expect(res.body.error.message).toBe('Chave inválida, revogada ou sem acesso à API.');
  });
});

describe('Atualizar preço e stock — a razão de a API existir', () => {
  let sku;
  beforeAll(async () => {
    const p = await prisma.product.findFirst({ where: { supplierId: fornecedora.id, sku: { not: null } } });
    sku = p?.sku;
    if (!sku) {
      const qualquer = await prisma.product.findFirst({ where: { supplierId: fornecedora.id } });
      await prisma.product.update({ where: { id: qualquer.id }, data: { sku: 'TESTE-API-001' } });
      sku = 'TESTE-API-001';
    }
  });

  test('atualiza o preço e devolve o item novo', async () => {
    const res = await request(app).patch(`/api/v1/catalogo/${sku}`)
      .set('Authorization', `Bearer ${chave}`).send({ preco: 12345.67, stock: 42 });
    expect(res.status).toBe(200);
    expect(res.body.preco).toBe(12345.67);
    expect(res.body.stock).toBe(42);
  });

  test('recusa valores impossíveis, e diz qual o campo', async () => {
    const res = await request(app).patch(`/api/v1/catalogo/${sku}`)
      .set('Authorization', `Bearer ${chave}`).send({ preco: -1, stock: 2.5 });
    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/preco/);
    expect(res.body.error.message).toMatch(/stock/);
  });

  test('um pedido vazio não passa por sucesso', async () => {
    const res = await request(app).patch(`/api/v1/catalogo/${sku}`)
      .set('Authorization', `Bearer ${chave}`).send({});
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('NADA_A_ALTERAR');
  });

  test('um SKU de outra empresa não existe, do ponto de vista desta chave', async () => {
    const alheio = await prisma.product.findFirst({
      where: { supplierId: { not: fornecedora.id }, sku: { not: null } },
      select: { sku: true },
    });
    if (!alheio) return;
    const res = await request(app).patch(`/api/v1/catalogo/${alheio.sku}`)
      .set('Authorization', `Bearer ${chave}`).send({ preco: 1 });
    expect(res.status).toBe(404);
  });

  // O que a máquina altera tem de deixar o mesmo rasto que a pessoa altera.
  test('a alteração fica no trilho, com a chave identificada', async () => {
    await request(app).patch(`/api/v1/catalogo/${sku}`)
      .set('Authorization', `Bearer ${chave}`).send({ preco: 999 });
    const registo = await prisma.auditLog.findFirst({
      where: { action: 'CATALOGO_ATUALIZADO_POR_API' },
      orderBy: { createdAt: 'desc' },
    });
    expect(registo).toBeTruthy();
    expect(registo.actorName).toMatch(/^API \(kxm_/);
    expect(registo.detail.campos).toContain('unitPrice');
  });
});

describe('Revogar e perder o plano', () => {
  test('uma chave revogada deixa de entrar de imediato', async () => {
    const criada = await auth(tokens.fornecedor).post('/api/catalog/api-keys').send({ nome: 'Para revogar' });
    expect((await comChave(criada.body.chave)).status).toBe(200);

    await auth(tokens.fornecedor).del(`/api/catalog/api-keys/${criada.body.id}`);
    expect((await comChave(criada.body.chave)).status).toBe(401);
  });

  test('a revogação não apaga o registo — o histórico de uso tem de sobreviver', async () => {
    const lista = await auth(tokens.fornecedor).get('/api/catalog/api-keys');
    const revogadas = lista.body.filter((k) => !k.ativa);
    expect(revogadas.length).toBeGreaterThan(0);
    expect(revogadas[0].prefixo).toMatch(/^kxm_/);
  });

  // O Pro não se paga uma vez e fica.
  test('descer de plano corta o acesso das chaves existentes', async () => {
    expect((await comChave(chave)).status).toBe(200);
    await prisma.company.update({ where: { id: fornecedora.id }, data: { plan: 'CORE', searchRank: 1 } });
    expect((await comChave(chave)).status).toBe(401);
    await prisma.company.update({ where: { id: fornecedora.id }, data: { plan: 'PRO', searchRank: 2 } });
    expect((await comChave(chave)).status).toBe(200);
  });

  test('o uso fica carimbado, para se ver uma chave que ninguém usa', async () => {
    await comChave(chave);
    // O carimbo é escrito sem esperar pela resposta; dá-se-lhe um instante.
    await new Promise((r) => setTimeout(r, 300));
    const registo = await prisma.apiKey.findUnique({ where: { id: chaveId } });
    expect(registo.ultimoUso).toBeTruthy();
  });
});
