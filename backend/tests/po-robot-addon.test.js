// tests/po-robot-addon.test.js
// Automatic PO Robot — billing do add-on. Mesma regra de assinaturaService:
// pedir NÃO liga nada, só a confirmação (com comprovativo) ativa o add-on.
//
// Cobre:
//   1. pedir exige plano PRO e RBAC (só COMPANY_ADMIN);
//   2. o fluxo completo — pedir → comprovativo → confirmar → CompanyAddon ATIVO;
//   3. só pode existir uma cobrança em aberto por empresa/add-on de cada vez;
//   4. sem o add-on ativo, o robot recusa-se a operar (poRoboRoutes);
//   5. RBAC da fila da KIXIMA e do catálogo de add-ons.
const { request, app, prisma, loginAll, auth } = require('./helpers');

const COMPROVATIVO = Buffer.from('%PDF-1.4 comprovativo add-on PO Robot');
const ADDON_KEY = 'PO_ROBOT';

let tokens;
let compradora;
let planoOriginal;
let addonOriginal;

beforeAll(async () => {
  tokens = await loginAll();
  compradora = await prisma.company.findFirst({ where: { type: 'CLIENTE' } });
  planoOriginal = { plan: compradora.plan, searchRank: compradora.searchRank };
  addonOriginal = await prisma.companyAddon.findUnique({
    where: { companyId_addonKey: { companyId: compradora.id, addonKey: ADDON_KEY } },
  });
});

afterEach(async () => {
  // Cada teste parte de uma empresa sem cobrança em aberto — a mesma regra
  // de "uma cobrança viva por vez" de assinatura.test.js — e sem o add-on
  // ativo (senão pedir() recusa com "já está ativo"). Os describes que
  // precisam do add-on ativo ligam-no explicitamente no seu próprio beforeAll.
  await prisma.addonCobranca.deleteMany({ where: { companyId: compradora.id, status: { in: ['PENDENTE', 'COMPROVATIVO_ENVIADO'] } } });
  await prisma.companyAddon.deleteMany({ where: { companyId: compradora.id, addonKey: ADDON_KEY } });
});

afterAll(async () => {
  await prisma.company.update({ where: { id: compradora.id }, data: planoOriginal });
  await prisma.addonCobranca.deleteMany({ where: { companyId: compradora.id } });
  if (addonOriginal) {
    await prisma.companyAddon.update({ where: { id: addonOriginal.id }, data: addonOriginal });
  } else {
    await prisma.companyAddon.deleteMany({ where: { companyId: compradora.id, addonKey: ADDON_KEY } });
  }
  await prisma.poRoboRegra.deleteMany({ where: { companyId: compradora.id } });
  await prisma.$disconnect();
});

async function pedirPoRobot() {
  const res = await auth(tokens.companyAdmin).post(`/api/addons/${ADDON_KEY}/pedir`);
  expect(res.status).toBe(201);
  return res.body;
}

describe('Catálogo de add-ons', () => {
  test('qualquer utilizador autenticado vê o catálogo, com o PO Robot exigindo PRO', async () => {
    const res = await auth(tokens.comprador).get('/api/addons/catalogo');
    expect(res.status).toBe(200);
    const poRobot = res.body.find((a) => a.addonKey === ADDON_KEY);
    expect(poRobot).toBeTruthy();
    expect(poRobot.requerPlano).toBe('PRO');
    expect(poRobot.preco.valorUsd).toBeGreaterThan(0);
  });

  test('sem sessão, 401', async () => {
    const res = await request(app).get('/api/addons/catalogo');
    expect(res.status).toBe(401);
  });
});

describe('Pedir o add-on — RBAC e gate de plano', () => {
  test('só o Company Admin pode pedir', async () => {
    await prisma.company.update({ where: { id: compradora.id }, data: { plan: 'PRO', searchRank: 2 } });
    const resFin = await auth(tokens.financeiro).post(`/api/addons/${ADDON_KEY}/pedir`);
    const resCompr = await auth(tokens.comprador).post(`/api/addons/${ADDON_KEY}/pedir`);
    expect(resFin.status).toBe(403);
    expect(resCompr.status).toBe(403);
  });

  test('exige o plano PRO — CORE é recusado com a mensagem certa', async () => {
    await prisma.company.update({ where: { id: compradora.id }, data: { plan: 'CORE', searchRank: 1 } });
    const res = await auth(tokens.companyAdmin).post(`/api/addons/${ADDON_KEY}/pedir`);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/PRO/);
  });

  test('só pode haver uma cobrança em aberto por vez', async () => {
    await prisma.company.update({ where: { id: compradora.id }, data: { plan: 'PRO', searchRank: 2 } });
    await pedirPoRobot();
    const outra = await auth(tokens.companyAdmin).post(`/api/addons/${ADDON_KEY}/pedir`);
    expect(outra.status).toBe(409);
  });
});

describe('Fluxo completo: pedir → comprovativo → confirmar → add-on ativo', () => {
  beforeAll(async () => {
    await prisma.company.update({ where: { id: compradora.id }, data: { plan: 'PRO', searchRank: 2 } });
  });

  test('o add-on não fica ativo antes da confirmação', async () => {
    const cobranca = await pedirPoRobot();
    expect(cobranca.referencia).toMatch(/^ADD-/);
    expect(cobranca.status).toBe('PENDENTE');

    const estado = await auth(tokens.companyAdmin).get(`/api/addons/${ADDON_KEY}/estado`);
    expect(estado.status).toBe(200);
    expect(estado.body.ativo).toBe(false);
    expect(estado.body.emAberto.id).toBe(cobranca.id);
  });

  test('sem comprovativo, confirmar é recusado', async () => {
    const cobranca = await pedirPoRobot();
    const res = await auth(tokens.adminSistema).post(`/api/addons/${cobranca.id}/confirmar`).send({});
    expect(res.status).toBe(400);
  });

  test('carregar comprovativo passa a aguardar confirmação da KIXIMA', async () => {
    const cobranca = await pedirPoRobot();
    const res = await request(app)
      .post(`/api/addons/${cobranca.id}/comprovativo`)
      .set('Authorization', `Bearer ${tokens.companyAdmin}`)
      .attach('comprovativo', COMPROVATIVO, 'transferencia.pdf');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('COMPROVATIVO_ENVIADO');
    expect(res.body.comprovativoUrl).toBeTruthy();

    const estado = await auth(tokens.companyAdmin).get(`/api/addons/${ADDON_KEY}/estado`);
    expect(estado.body.ativo).toBe(false);
  });

  test('a confirmação da KIXIMA é o único sítio onde o add-on liga', async () => {
    const cobranca = await pedirPoRobot();
    await request(app)
      .post(`/api/addons/${cobranca.id}/comprovativo`)
      .set('Authorization', `Bearer ${tokens.companyAdmin}`)
      .attach('comprovativo', COMPROVATIVO, 'transferencia.pdf');

    const confirmar = await auth(tokens.adminSistema).post(`/api/addons/${cobranca.id}/confirmar`).send({});
    expect(confirmar.status).toBe(200);
    expect(confirmar.body.status).toBe('CONFIRMADA');

    const estado = await auth(tokens.companyAdmin).get(`/api/addons/${ADDON_KEY}/estado`);
    expect(estado.body.ativo).toBe(true);
    expect(estado.body.activatedAt).toBeTruthy();

    const addon = await prisma.companyAddon.findUnique({
      where: { companyId_addonKey: { companyId: compradora.id, addonKey: ADDON_KEY } },
    });
    expect(addon.status).toBe('ATIVO');

    const auditoria = await prisma.auditLog.findFirst({
      where: { entityType: 'AddonCobranca', entityId: cobranca.id, action: 'ADDON_CONFIRMADO' },
    });
    expect(auditoria).toBeTruthy();
  });

  test('company admin não confirma cobranças — é trabalho da KIXIMA', async () => {
    const cobranca = await pedirPoRobot();
    const res = await auth(tokens.companyAdmin).post(`/api/addons/${cobranca.id}/confirmar`).send({});
    expect(res.status).toBe(403);
  });
});

describe('Cancelar cobrança', () => {
  beforeAll(async () => {
    await prisma.company.update({ where: { id: compradora.id }, data: { plan: 'PRO', searchRank: 2 } });
  });

  test('cancelar liberta a empresa para pedir de novo', async () => {
    const cobranca = await pedirPoRobot();
    const cancelar = await auth(tokens.companyAdmin).post(`/api/addons/${cobranca.id}/cancelar`).send({ motivo: 'Pedido por engano' });
    expect(cancelar.status).toBe(200);
    expect(cancelar.body.status).toBe('CANCELADA');

    const outra = await auth(tokens.companyAdmin).post(`/api/addons/${ADDON_KEY}/pedir`);
    expect(outra.status).toBe(201);
  });
});

describe('Fila da KIXIMA — RBAC', () => {
  test('company admin não vê a fila de add-ons — é trabalho interno da KIXIMA', async () => {
    const res = await auth(tokens.companyAdmin).get('/api/addons/fila');
    expect(res.status).toBe(403);
  });

  test('admin do sistema com permissão financeira vê a fila', async () => {
    await prisma.company.update({ where: { id: compradora.id }, data: { plan: 'PRO', searchRank: 2 } });
    await pedirPoRobot();
    const res = await auth(tokens.adminSistema).get('/api/addons/fila');
    expect(res.status).toBe(200);
    expect(res.body.porPagar).toBeGreaterThan(0);
    expect(Array.isArray(res.body.emAberto)).toBe(true);
  });
});

describe('poRoboRoutes — bloqueadas sem o add-on ativo', () => {
  let product;

  beforeAll(async () => {
    await prisma.company.update({ where: { id: compradora.id }, data: { plan: 'PRO', searchRank: 2 } });
    await prisma.companyAddon.deleteMany({ where: { companyId: compradora.id, addonKey: ADDON_KEY } });
    const catalog = await auth(tokens.comprador).get('/api/catalog');
    product = catalog.body[0];
  });

  test('listar/criar regras é recusado sem o add-on ativo', async () => {
    const criar = await auth(tokens.companyAdmin).post('/api/po-robot/regras').send({
      productId: product.id, mediaOrigem: 'MANUAL', mediaMensal: 10, periodicidade: 'MENSAL',
    });
    expect(criar.status).toBe(400);
    expect(criar.body.error.message).toMatch(/add-on pago/);
  });

  test('media-sugerida também exige o add-on ativo', async () => {
    const res = await auth(tokens.companyAdmin).get(`/api/po-robot/media-sugerida/${product.id}`);
    expect(res.status).toBe(400);
  });
});

describe('poRoboRoutes — CRUD de regras com o add-on ativo', () => {
  let product;
  let regraId;

  beforeAll(async () => {
    const catalog = await auth(tokens.comprador).get('/api/catalog');
    product = catalog.body[0];
  });

  // beforeEach (não beforeAll): o afterEach de topo desliga o add-on depois de
  // CADA teste (para não colidir com "pedir" noutros describes) — este bloco
  // precisa de o religar antes de cada um dos seus próprios testes.
  beforeEach(async () => {
    await prisma.company.update({ where: { id: compradora.id }, data: { plan: 'PRO', searchRank: 2 } });
    await prisma.companyAddon.upsert({
      where: { companyId_addonKey: { companyId: compradora.id, addonKey: ADDON_KEY } },
      create: { companyId: compradora.id, addonKey: ADDON_KEY, status: 'ATIVO', activatedAt: new Date() },
      update: { status: 'ATIVO', activatedAt: new Date() },
    });
  });

  afterAll(async () => {
    if (regraId) await prisma.poRoboRegra.deleteMany({ where: { id: regraId } });
  });

  test('validação: mediaMensal tem de ser maior que zero', async () => {
    const res = await auth(tokens.companyAdmin).post('/api/po-robot/regras').send({
      productId: product.id, mediaOrigem: 'MANUAL', mediaMensal: 0, periodicidade: 'MENSAL',
    });
    expect(res.status).toBe(422);
  });

  test('criar, listar, atualizar e remover uma regra', async () => {
    const criar = await auth(tokens.companyAdmin).post('/api/po-robot/regras').send({
      productId: product.id, mediaOrigem: 'MANUAL', mediaMensal: 12, periodicidade: 'MENSAL', limiteMaximoUsd: 5000,
    });
    expect(criar.status).toBe(201);
    expect(criar.body.ativo).toBe(true);
    expect(new Date(criar.body.proximaExecucaoEm).getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    regraId = criar.body.id;

    const listar = await auth(tokens.companyAdmin).get('/api/po-robot/regras');
    expect(listar.status).toBe(200);
    expect(listar.body.some((r) => r.id === regraId)).toBe(true);

    const desativar = await auth(tokens.companyAdmin).put(`/api/po-robot/regras/${regraId}`).send({ ativo: false });
    expect(desativar.status).toBe(200);
    expect(desativar.body.ativo).toBe(false);

    const remover = await auth(tokens.companyAdmin).del(`/api/po-robot/regras/${regraId}`);
    expect(remover.status).toBe(204);
    regraId = null;

    const auditoria = await prisma.auditLog.findFirst({
      where: { entityType: 'PoRoboRegra', action: 'PO_ROBO_REGRA_REMOVIDA' },
      orderBy: { createdAt: 'desc' },
    });
    expect(auditoria).toBeTruthy();
  });

  test('media-sugerida devolve um número (mesmo sem histórico)', async () => {
    const res = await auth(tokens.companyAdmin).get(`/api/po-robot/media-sugerida/${product.id}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.mediaMensal).toBe('number');
  });
});
