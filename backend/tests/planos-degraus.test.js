// tests/planos-degraus.test.js
// Os três degraus que a matriz de planos vendia sem os aplicar (KX-08):
//   - selo (destaque na pesquisa)         → só Pro
//   - contratos-quadro                    → só Pro, e do lado do CLIENTE
//   - histórico de relatórios em meses     → 3 / 12 / sem limite
//
// Cada um falhava de maneira diferente e nenhum falhava alto:
//   o selo estava certo por coincidência (o frontend lia a POSIÇÃO na pesquisa,
//   não o selo); o contrato-quadro não tinha guarda nenhuma; e a janela de
//   histórico nunca chegou a existir — o relatório agregava desde sempre para
//   toda a gente. Estes testes existem para cada um deles voltar a falhar alto.

const { auth, prisma, loginAll, USERS } = require('./helpers');
const plans = require('../src/services/planService');
const reports = require('../src/services/reportsService');

let tokens;
let clientCompanyId;
let planoOriginal;

beforeAll(async () => {
  tokens = await loginAll();
  const comprador = await prisma.user.findUnique({ where: { email: USERS.comprador } });
  clientCompanyId = comprador.companyId;
  const empresa = await prisma.company.findUnique({
    where: { id: clientCompanyId }, select: { plan: true },
  });
  planoOriginal = empresa.plan;
});

afterAll(async () => {
  await prisma.contract.deleteMany({});
  if (planoOriginal) {
    await prisma.company.update({ where: { id: clientCompanyId }, data: { plan: planoOriginal } });
  }
  await prisma.$disconnect();
});

const porPlano = (plan) => prisma.company.update({ where: { id: clientCompanyId }, data: { plan } });

describe('Janela de histórico dos relatórios', () => {
  test('cada plano tem a sua janela, e o Pro não tem nenhuma', () => {
    expect(reports.janelaDoPlano('BASE').meses).toBe(3);
    expect(reports.janelaDoPlano('CORE').meses).toBe(12);
    expect(reports.janelaDoPlano('PRO').ilimitado).toBe(true);
    expect(reports.janelaDoPlano('PRO').meses).toBeNull();
  });

  test('pedir MENOS do que o plano dá é sempre aceite', () => {
    const j = reports.janelaDoPlano('CORE', 2);
    expect(j.meses).toBe(2);
    expect(j.truncada).toBe(false);
  });

  test('pedir MAIS do que o plano dá é cortado, e o corte é declarado', () => {
    const j = reports.janelaDoPlano('BASE', 24);
    expect(j.meses).toBe(3);
    expect(j.truncada).toBe(true);
    expect(j.limitePlano).toBe(3);
  });

  test('um pedido absurdo não abre nem fecha a janela por acidente', () => {
    // Um `meses` inválido tem de cair na janela do plano, e não em "sem janela"
    // (que daria tudo a um plano BASE) nem em zero (que não daria nada).
    for (const lixo of ['abc', '-4', '0', '', null, undefined]) {
      expect(reports.janelaDoPlano('BASE', lixo).meses).toBe(3);
    }
  });

  test('o relatório diz que janela aplicou e o que ficou de fora dela', async () => {
    // O plano que conta aqui é o do FORNECEDOR — é a empresa dele que o
    // endpoint lê. Pôr o do comprador seria mudar a empresa errada e deixar o
    // teste a depender do plano que o fornecedor calhasse ter.
    const f = await prisma.user.findUnique({ where: { email: USERS.fornecedor } });
    const antes = await prisma.company.findUnique({
      where: { id: f.companyId }, select: { plan: true },
    });
    await prisma.company.update({ where: { id: f.companyId }, data: { plan: 'BASE' } });

    const res = await auth(tokens.fornecedor).get('/api/reports/fornecedor');
    await prisma.company.update({ where: { id: f.companyId }, data: { plan: antes.plan } });

    expect(res.status).toBe(200);
    expect(res.body.janela).toBeDefined();
    expect(res.body.janela.desde).toEqual(expect.any(String));
    // Os números que a janela NÃO cobre têm de estar identificados: sem isto,
    // um total de encomendas de 3 meses ao lado de um contador de visitas de
    // sempre é indistinguível de um erro de cálculo.
    expect(res.body.janela.semJanela).toContain('totalViews');
    expect(res.body.janela.semJanela).toContain('totalProducts');
  });
});

describe('Contratos-quadro', () => {
  const corpo = (supplierCompanyId) => ({
    clientCompanyId,
    supplierCompanyId,
    categoriesCovered: ['Válvulas'],
    totalValue: 1000000,
    currency: 'AOA',
    billingPeriodicity: 'TRIMESTRAL',
    paymentTermDays: 30,
    validFrom: new Date(Date.now() - 86400000).toISOString(),
    validUntil: new Date(Date.now() + 365 * 86400000).toISOString(),
  });

  let supplierCompanyId;
  beforeAll(async () => {
    const f = await prisma.user.findUnique({ where: { email: USERS.fornecedor } });
    supplierCompanyId = f.companyId;
  });

  test('um cliente CORE é recusado, e a mensagem diz qual é o plano que o inclui', async () => {
    await porPlano('CORE');
    const res = await auth(tokens.adminSistema).post('/api/contracts').send(corpo(supplierCompanyId));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PLANO_INSUFICIENTE');
    expect(res.body.error.message).toMatch(/PRO/);
  });

  test('a guarda vale mesmo quando é o Admin do Sistema a criar', async () => {
    // A via de administração não pode ser a porta por onde a funcionalidade
    // paga sai de graça. Já coberto acima — este teste fixa a intenção.
    await porPlano('BASE');
    const res = await auth(tokens.adminSistema).post('/api/contracts').send(corpo(supplierCompanyId));
    expect(res.status).toBe(400);
  });

  test('um cliente PRO cria o contrato', async () => {
    await porPlano('PRO');
    const res = await auth(tokens.adminSistema).post('/api/contracts').send(corpo(supplierCompanyId));
    expect(res.status).toBeLessThan(300);
    expect(res.body.reference).toMatch(/^CTR-/);
    await prisma.contract.deleteMany({ where: { id: res.body.id } });
  });

  test('o plano do FORNECEDOR não bloqueia — estreitar o catálogo custa mais', async () => {
    await porPlano('PRO');
    const antes = await prisma.company.findUnique({
      where: { id: supplierCompanyId }, select: { plan: true },
    });
    await prisma.company.update({ where: { id: supplierCompanyId }, data: { plan: 'BASE' } });
    const res = await auth(tokens.adminSistema).post('/api/contracts').send(corpo(supplierCompanyId));
    await prisma.company.update({ where: { id: supplierCompanyId }, data: { plan: antes.plan } });

    expect(res.status).toBeLessThan(300);
    await prisma.contract.deleteMany({ where: { id: res.body.id } });
  });
});

describe('Selo de destaque na pesquisa', () => {
  test('sai da matriz de planos, e não da posição na pesquisa', () => {
    // São duas funcionalidades distintas que hoje calham no mesmo degrau. O
    // teste separa-as: se o selo descer para o CORE, é a matriz que manda.
    expect(plans.hasFeature('PRO', 'selo')).toBe(true);
    expect(plans.hasFeature('CORE', 'selo')).toBe(false);
    expect(plans.hasFeature('BASE', 'selo')).toBe(false);
  });

  test('a pesquisa devolve o booleano do selo e NÃO devolve o plano', async () => {
    const res = await auth(tokens.comprador).get('/api/marketplace/search?limit=5');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);

    for (const item of res.body.items) {
      expect(item.supplier).toBeDefined();
      expect(typeof item.supplier.destaque).toBe('boolean');
      // Qual é o plano de um fornecedor não é assunto de quem compra.
      expect(item.supplier.plan).toBeUndefined();
    }
  });

  test('o selo acompanha o plano do fornecedor', async () => {
    const f = await prisma.user.findUnique({ where: { email: USERS.fornecedor } });
    const antes = await prisma.company.findUnique({
      where: { id: f.companyId }, select: { plan: true },
    });

    const seloComPlano = async (plan) => {
      await prisma.company.update({ where: { id: f.companyId }, data: { plan } });
      const res = await auth(tokens.comprador).get('/api/marketplace/search?limit=48');
      const meu = res.body.items.find((i) => i.supplier.id === f.companyId);
      return meu ? meu.supplier.destaque : null;
    };

    expect(await seloComPlano('PRO')).toBe(true);
    expect(await seloComPlano('CORE')).toBe(false);

    await prisma.company.update({ where: { id: f.companyId }, data: { plan: antes.plan } });
  });
});
