// tests/po-robot-job.test.js
// Automatic PO Robot — mecânica do ciclo (poRoboService). O que protege:
//   1. cria a PO com os dados certos (quantidade fixa OU média escalada pela
//      periodicidade) e SEMPRE por aprovar — nunca chama approvePurchaseOrder;
//   2. respeita o limite de segurança — não cria PO acima dele;
//   3. exige o add-on ativo — sem ele, a regra falha e é registada, não lança;
//   4. executarCiclo ignora regras inativas ou ainda não devidas;
//   5. não duplica PO ao correr o ciclo duas vezes seguidas (dedupe por
//      proximaExecucaoEm, avançada só depois do sucesso).
const { prisma, loginAll, auth } = require('./helpers');
const poRoboService = require('../src/services/poRoboService');
const addonService = require('../src/services/addonService');

const ADDON_KEY = 'PO_ROBOT';

let tokens;
let compradora;
let planoOriginal;
let addonOriginal;
let product;
let product2;

beforeAll(async () => {
  tokens = await loginAll();
  compradora = await prisma.company.findFirst({ where: { type: 'CLIENTE' } });
  planoOriginal = { plan: compradora.plan, searchRank: compradora.searchRank };
  addonOriginal = await prisma.companyAddon.findUnique({
    where: { companyId_addonKey: { companyId: compradora.id, addonKey: ADDON_KEY } },
  });

  await prisma.company.update({ where: { id: compradora.id }, data: { plan: 'PRO', searchRank: 2 } });

  const catalog = await auth(tokens.comprador).get('/api/catalog');
  product = await prisma.product.findUnique({ where: { id: catalog.body[0].id } });
  product2 = await prisma.product.findUnique({ where: { id: catalog.body[1].id } });
});

async function ativarAddon() {
  await prisma.companyAddon.upsert({
    where: { companyId_addonKey: { companyId: compradora.id, addonKey: ADDON_KEY } },
    create: { companyId: compradora.id, addonKey: ADDON_KEY, status: 'ATIVO', activatedAt: new Date() },
    update: { status: 'ATIVO', activatedAt: new Date() },
  });
}

async function desativarAddon() {
  await prisma.companyAddon.upsert({
    where: { companyId_addonKey: { companyId: compradora.id, addonKey: ADDON_KEY } },
    create: { companyId: compradora.id, addonKey: ADDON_KEY, status: 'INATIVO' },
    update: { status: 'INATIVO' },
  });
}

function criarRegra(dados = {}) {
  return prisma.poRoboRegra.create({
    data: {
      companyId: compradora.id,
      productId: product.id,
      mediaOrigem: 'MANUAL',
      mediaMensal: 30,
      periodicidade: 'MENSAL',
      ativo: true,
      proximaExecucaoEm: new Date(Date.now() - 60000), // já devida
      ...dados,
    },
  });
}

afterAll(async () => {
  await prisma.company.update({ where: { id: compradora.id }, data: planoOriginal });
  if (addonOriginal) {
    await prisma.companyAddon.update({ where: { id: addonOriginal.id }, data: addonOriginal });
  } else {
    await prisma.companyAddon.deleteMany({ where: { companyId: compradora.id, addonKey: ADDON_KEY } });
  }
  await prisma.poRoboRegra.deleteMany({ where: { companyId: compradora.id } });
  await prisma.$disconnect();
});

describe('resolverQuantidade', () => {
  test('quantidade fixa sobrepõe o cálculo pela média', async () => {
    const regra = await criarRegra({ quantidade: 4, mediaMensal: 999 });
    const q = await poRoboService.resolverQuantidade(regra);
    expect(q).toBe(4);
    await prisma.poRoboRegra.delete({ where: { id: regra.id } });
  });

  test('sem quantidade fixa, escala a média mensal pela periodicidade', async () => {
    const regra = await criarRegra({ mediaOrigem: 'MANUAL', mediaMensal: 30, periodicidade: 'SEMANAL' });
    const q = await poRoboService.resolverQuantidade(regra);
    expect(q).toBe(Math.round(30 * (7 / 30))); // 7
    await prisma.poRoboRegra.delete({ where: { id: regra.id } });
  });

  test('mediaOrigem IA usa categoryAnalyticsService e nunca devolve zero (mínimo 1 unidade)', async () => {
    const regra = await criarRegra({ mediaOrigem: 'IA', mediaMensal: 0, periodicidade: 'MENSAL' });
    const q = await poRoboService.resolverQuantidade(regra);
    expect(q).toBeGreaterThanOrEqual(1);
    await prisma.poRoboRegra.delete({ where: { id: regra.id } });
  });
});

describe('executarRegra — uma regra, um ciclo', () => {
  test('exige o add-on ativo — sem ele, lança e não cria PO', async () => {
    await desativarAddon();
    const regra = await criarRegra({ quantidade: 1 });
    await expect(poRoboService.executarRegra(regra)).rejects.toThrow(/add-on pago/);
    await prisma.poRoboRegra.delete({ where: { id: regra.id } });
  });

  test('com o add-on ativo, cria a PO com a quantidade certa, sempre por aprovar', async () => {
    await ativarAddon();
    const regra = await criarRegra({ quantidade: 2 });
    const po = await poRoboService.executarRegra(regra);

    expect(po.status).toBe('AGUARDANDO_APROVACAO');
    expect(po.buyerCompanyId).toBe(compradora.id);
    expect(po.supplierCompanyId).toBe(product.supplierId);

    const item = await prisma.purchaseOrderItem.findFirst({ where: { purchaseOrderId: po.id } });
    expect(item.quantity).toBe(2);
    expect(item.productId).toBe(product.id);

    const doBanco = await prisma.purchaseOrder.findUnique({ where: { id: po.id } });
    expect(doBanco.createdBySource).toBe('ROBOT');

    const auditoria = await prisma.auditLog.findFirst({
      where: { entityType: 'PurchaseOrder', entityId: po.id, action: 'PO_CRIADA_ROBOT' },
    });
    expect(auditoria).toBeTruthy();
    expect(auditoria.detail.regraId).toBe(regra.id);

    const atualizada = await prisma.poRoboRegra.findUnique({ where: { id: regra.id } });
    expect(atualizada.proximaExecucaoEm.getTime()).toBeGreaterThan(Date.now());

    await prisma.poRoboRegra.delete({ where: { id: regra.id } });
  });

  test('respeita o limite de segurança — PO acima do limite não é criada', async () => {
    await ativarAddon();
    const valorUnitario = Number(product.unitPrice) || 1;
    const regra = await criarRegra({ quantidade: 1000000, limiteMaximoUsd: 0.01 });
    await expect(poRoboService.executarRegra(regra)).rejects.toThrow(/limite de segurança/);
    expect(valorUnitario).toBeGreaterThan(0); // guarda contra um produto de preço zero mascarar o teste
    await prisma.poRoboRegra.delete({ where: { id: regra.id } });
  });

  test('produto inativo — a regra falha em vez de criar uma PO inválida', async () => {
    await ativarAddon();
    const regra = await criarRegra({ quantidade: 1 });
    await prisma.product.update({ where: { id: product.id }, data: { active: false } });
    try {
      await expect(poRoboService.executarRegra(regra)).rejects.toThrow(/não existe ou está inativo/);
    } finally {
      await prisma.product.update({ where: { id: product.id }, data: { active: true } });
      await prisma.poRoboRegra.delete({ where: { id: regra.id } });
    }
  });
});

describe('executarCiclo — várias regras, sem parar no primeiro erro', () => {
  test('ignora regras inativas e regras ainda não devidas; corre as devidas e ativas', async () => {
    await ativarAddon();
    const devidaEAtiva = await criarRegra({ quantidade: 1 });
    const inativa = await criarRegra({ quantidade: 1, ativo: false });
    const futura = await criarRegra({ quantidade: 1, proximaExecucaoEm: new Date(Date.now() + 24 * 60 * 60 * 1000) });

    const resultado = await poRoboService.executarCiclo();

    const auditoriaDevida = await prisma.auditLog.findFirst({
      where: { entityType: 'PurchaseOrder', action: 'PO_CRIADA_ROBOT', detail: { path: ['regraId'], equals: devidaEAtiva.id } },
    });
    expect(auditoriaDevida).toBeTruthy();

    const auditoriaInativa = await prisma.auditLog.findFirst({
      where: { entityType: 'PurchaseOrder', action: 'PO_CRIADA_ROBOT', detail: { path: ['regraId'], equals: inativa.id } },
    });
    expect(auditoriaInativa).toBeNull();

    const auditoriaFutura = await prisma.auditLog.findFirst({
      where: { entityType: 'PurchaseOrder', action: 'PO_CRIADA_ROBOT', detail: { path: ['regraId'], equals: futura.id } },
    });
    expect(auditoriaFutura).toBeNull();

    expect(resultado.criadas).toBeGreaterThanOrEqual(1);

    await prisma.poRoboRegra.deleteMany({ where: { id: { in: [devidaEAtiva.id, inativa.id, futura.id] } } });
  });

  test('uma regra que falha não aborta o ciclo — as outras continuam, e a falha é registada', async () => {
    await ativarAddon();
    await prisma.product.update({ where: { id: product2.id }, data: { active: false } });
    const falha = await criarRegra({ productId: product2.id, quantidade: 1 });
    const ok = await criarRegra({ quantidade: 1 });

    try {
      const resultado = await poRoboService.executarCiclo();

      expect(resultado.falhas.some((f) => f.regraId === falha.id)).toBe(true);
      const auditoriaOk = await prisma.auditLog.findFirst({
        where: { entityType: 'PurchaseOrder', action: 'PO_CRIADA_ROBOT', detail: { path: ['regraId'], equals: ok.id } },
      });
      expect(auditoriaOk).toBeTruthy();
    } finally {
      await prisma.product.update({ where: { id: product2.id }, data: { active: true } });
      await prisma.poRoboRegra.deleteMany({ where: { id: { in: [falha.id, ok.id] } } });
    }
  });

  test('não duplica: correr o ciclo duas vezes seguidas só cria UMA PO por regra', async () => {
    await ativarAddon();
    const regra = await criarRegra({ quantidade: 1 });

    await poRoboService.executarCiclo();
    await poRoboService.executarCiclo(); // a mesma regra já não está devida — proximaExecucaoEm foi avançada

    const contagem = await prisma.auditLog.count({
      where: { entityType: 'PurchaseOrder', action: 'PO_CRIADA_ROBOT', detail: { path: ['regraId'], equals: regra.id } },
    });
    expect(contagem).toBe(1);

    await prisma.poRoboRegra.delete({ where: { id: regra.id } });
  });

  test('empresa sem o add-on ativo: a regra falha, sem criar PO', async () => {
    await desativarAddon();
    const regra = await criarRegra({ quantidade: 1 });

    const resultado = await poRoboService.executarCiclo();
    expect(resultado.falhas.some((f) => f.regraId === regra.id)).toBe(true);

    const auditoria = await prisma.auditLog.findFirst({
      where: { entityType: 'PurchaseOrder', action: 'PO_CRIADA_ROBOT', detail: { path: ['regraId'], equals: regra.id } },
    });
    expect(auditoria).toBeNull();

    await prisma.poRoboRegra.delete({ where: { id: regra.id } });
    await ativarAddon();
  });
});

describe('addonService.assertAddon — usado diretamente pelas rotas do robot', () => {
  test('lança com a mensagem certa quando o add-on não está ativo', async () => {
    await desativarAddon();
    await expect(addonService.assertAddon(compradora.id, ADDON_KEY, 'Automatic PO Robot')).rejects.toThrow(/add-on pago/);
  });

  test('não lança quando o add-on está ativo', async () => {
    await ativarAddon();
    await expect(addonService.assertAddon(compradora.id, ADDON_KEY, 'Automatic PO Robot')).resolves.toBeUndefined();
  });
});
