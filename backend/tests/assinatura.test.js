// tests/assinatura.test.js
// Subscrição: pedir plano → comprovativo → confirmação.
//
// O que estes testes protegem é uma coisa só: que o plano NÃO muda antes de a
// KIXIMA confirmar o dinheiro. Tudo o resto (referências, preço congelado,
// lugares) são as maneiras conhecidas de furar essa regra.
const { auth, request, app, prisma, login } = require('./helpers');
const planService = require('../src/services/planService');
const assinaturaService = require('../src/services/assinaturaService');

const DIA_MS = 24 * 60 * 60 * 1000;
function hoje(deslocamentoDias) {
  return new Date(Date.now() + deslocamentoDias * DIA_MS);
}

const COMPROVATIVO = Buffer.from('%PDF-1.4 transferencia BAI subscricao');

let adminEmpresaToken;
let financeiroToken;
let adminSistemaToken;
let companyId;
let planoOriginal;
let validoAteOriginal;

beforeAll(async () => {
  [adminEmpresaToken, financeiroToken, adminSistemaToken] = await Promise.all([
    login('admin@petroangola.co.ao'),
    login('financeiro@petroangola.co.ao'),
    login('admin@kixima.co.ao'),
  ]);
  const admin = await prisma.user.findUnique({ where: { email: 'admin@petroangola.co.ao' } });
  companyId = admin.companyId;
  const empresa = await prisma.company.findUnique({ where: { id: companyId } });
  planoOriginal = empresa.plan;
  validoAteOriginal = empresa.planoValidoAte;
});

// Cada teste parte de uma empresa sem cobranças em aberto e no plano de origem:
// só pode haver UMA cobrança viva por empresa, por isso um teste que deixasse
// lixo bloqueava o seguinte com um 409 e a falha apontaria para o sítio errado.
beforeEach(async () => {
  await prisma.planoCobranca.deleteMany({ where: { companyId } });
  await prisma.company.update({
    where: { id: companyId },
    data: {
      plan: planoOriginal,
      searchRank: planService.rankDoPlano(planoOriginal),
      planoValidoAte: validoAteOriginal,
    },
  });
});

afterAll(async () => {
  await prisma.planoCobranca.deleteMany({ where: { companyId } });
  await prisma.company.update({
    where: { id: companyId },
    data: {
      plan: planoOriginal,
      searchRank: planService.rankDoPlano(planoOriginal),
      planoValidoAte: validoAteOriginal,
    },
  });
  await prisma.$disconnect();
});

async function pedirPro() {
  const res = await auth(adminEmpresaToken).post('/api/assinatura/pedir').send({ plano: 'PRO' });
  expect(res.status).toBe(201);
  return res.body;
}

describe('Subscrição — pedir', () => {
  test('o pedido emite uma cobrança e NÃO muda o plano', async () => {
    const cobranca = await pedirPro();

    expect(cobranca.status).toBe('PENDENTE');
    expect(cobranca.planoNovo).toBe('PRO');
    expect(cobranca.referencia).toMatch(/^SUB-\d{4}-\d{6}$/);

    // A regra inteira, numa asserção.
    const empresa = await prisma.company.findUnique({ where: { id: companyId } });
    expect(empresa.plan).toBe(planoOriginal);
  });

  test('o preço fica congelado na cobrança', async () => {
    const cobranca = await pedirPro();
    const tabela = planService.preco('PRO');
    expect(Number(cobranca.valorUsd)).toBe(tabela.valorUsd);
    expect(cobranca.periodo).toBe(tabela.periodo);
    expect(cobranca.meses).toBe(tabela.meses);
  });

  test('não deixa abrir uma segunda cobrança com uma por liquidar', async () => {
    const primeira = await pedirPro();
    const res = await auth(adminEmpresaToken).post('/api/assinatura/pedir').send({ plano: 'CORE' });
    expect(res.status).toBe(409);
    // A mensagem tem de dizer QUAL é a que está aberta — senão não há nada a fazer.
    expect(res.body.error.message).toContain(primeira.referencia);
  });

  test('recusa um plano que não existe', async () => {
    const res = await auth(adminEmpresaToken).post('/api/assinatura/pedir').send({ plano: 'PLATINUM' });
    expect(res.status).toBe(422);
  });

  test('o Financeiro não escolhe o plano (403)', async () => {
    const res = await auth(financeiroToken).post('/api/assinatura/pedir').send({ plano: 'PRO' });
    expect(res.status).toBe(403);
  });
});

describe('Subscrição — comprovativo', () => {
  test('sem comprovativo não passa a COMPROVATIVO_ENVIADO', async () => {
    const cobranca = await pedirPro();
    const res = await auth(adminEmpresaToken).post(`/api/assinatura/${cobranca.id}/comprovativo`).send({});
    expect(res.status).toBe(422);

    const depois = await prisma.planoCobranca.findUnique({ where: { id: cobranca.id } });
    expect(depois.status).toBe('PENDENTE');
  });

  test('com comprovativo passa a aguardar confirmação — e o plano ainda não mudou', async () => {
    const cobranca = await pedirPro();
    const res = await request(app)
      .post(`/api/assinatura/${cobranca.id}/comprovativo`)
      .set('Authorization', `Bearer ${financeiroToken}`)
      .attach('comprovativo', COMPROVATIVO, 'transferencia.pdf');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('COMPROVATIVO_ENVIADO');
    expect(res.body.comprovativoUrl).toBeTruthy();
    expect(res.body.submetidoEm).toBeTruthy();

    const empresa = await prisma.company.findUnique({ where: { id: companyId } });
    expect(empresa.plan).toBe(planoOriginal);
  });

  test('não aceita comprovativo de cobrança de outra empresa (403)', async () => {
    const cobranca = await pedirPro();
    const outra = await prisma.company.findFirst({ where: { id: { not: companyId }, status: 'APROVADA' } });
    await prisma.planoCobranca.update({ where: { id: cobranca.id }, data: { companyId: outra.id } });

    const res = await request(app)
      .post(`/api/assinatura/${cobranca.id}/comprovativo`)
      .set('Authorization', `Bearer ${adminEmpresaToken}`)
      .attach('comprovativo', COMPROVATIVO, 'transferencia.pdf');
    expect(res.status).toBe(403);

    await prisma.planoCobranca.update({ where: { id: cobranca.id }, data: { companyId } });
  });
});

describe('Subscrição — confirmação', () => {
  async function pedirEPagar() {
    const cobranca = await pedirPro();
    await request(app)
      .post(`/api/assinatura/${cobranca.id}/comprovativo`)
      .set('Authorization', `Bearer ${adminEmpresaToken}`)
      .attach('comprovativo', COMPROVATIVO, 'transferencia.pdf');
    return cobranca;
  }

  test('a confirmação é o único sítio onde o plano muda', async () => {
    const cobranca = await pedirEPagar();
    const res = await auth(adminSistemaToken).post(`/api/assinatura/${cobranca.id}/confirmar`).send({});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CONFIRMADA');

    const empresa = await prisma.company.findUnique({ where: { id: companyId } });
    expect(empresa.plan).toBe('PRO');
    // O rank tem de acompanhar: sem isto, quem pagou o Pro continuava no fundo
    // da pesquisa a pagar por algo que não recebia.
    expect(empresa.searchRank).toBe(planService.rankDoPlano('PRO'));
    expect(empresa.planoValidoAte).toBeTruthy();
  });

  test('recusa confirmar sem comprovativo', async () => {
    const cobranca = await pedirPro();
    const res = await auth(adminSistemaToken).post(`/api/assinatura/${cobranca.id}/confirmar`).send({});
    expect(res.status).toBe(400);

    const empresa = await prisma.company.findUnique({ where: { id: companyId } });
    expect(empresa.plan).toBe(planoOriginal);
  });

  test('confirmar duas vezes não estende o prazo outra vez', async () => {
    const cobranca = await pedirEPagar();
    const primeira = await auth(adminSistemaToken).post(`/api/assinatura/${cobranca.id}/confirmar`).send({});
    const validoAte = (await prisma.company.findUnique({ where: { id: companyId } })).planoValidoAte;

    const segunda = await auth(adminSistemaToken).post(`/api/assinatura/${cobranca.id}/confirmar`).send({});
    expect(primeira.status).toBe(200);
    expect(segunda.status).toBe(409);

    const depois = await prisma.company.findUnique({ where: { id: companyId } });
    expect(depois.planoValidoAte.toISOString()).toBe(validoAte.toISOString());
  });

  test('a empresa não confirma a sua própria cobrança (403)', async () => {
    const cobranca = await pedirEPagar();
    const res = await auth(adminEmpresaToken).post(`/api/assinatura/${cobranca.id}/confirmar`).send({});
    expect(res.status).toBe(403);

    const empresa = await prisma.company.findUnique({ where: { id: companyId } });
    expect(empresa.plan).toBe(planoOriginal);
  });

  test('a confirmação fica registada na auditoria', async () => {
    const cobranca = await pedirEPagar();
    await auth(adminSistemaToken).post(`/api/assinatura/${cobranca.id}/confirmar`).send({});
    const registo = await prisma.auditLog.findFirst({
      where: { action: 'SUBSCRICAO_CONFIRMADA', entityId: cobranca.id },
    });
    expect(registo).toBeTruthy();
    expect(registo.detail.para).toBe('PRO');
  });
});

describe('Subscrição — validade', () => {
  // A conta que decide quantos dias de acesso alguém comprou.
  test('renovar antes de expirar acrescenta ao prazo que já estava pago', () => {
    const agora = new Date('2026-03-01T00:00:00Z');
    const validoAte = new Date('2026-06-01T00:00:00Z');
    const novo = assinaturaService.novoValidoAte(validoAte, 3, agora);
    expect(novo.toISOString().slice(0, 10)).toBe('2026-09-01');
  });

  test('renovar depois de expirar conta a partir de hoje', () => {
    const agora = new Date('2026-08-01T00:00:00Z');
    const validoAte = new Date('2026-06-01T00:00:00Z');
    const novo = assinaturaService.novoValidoAte(validoAte, 3, agora);
    // Os dois meses em que esteve por pagar não se compram retroativamente.
    expect(novo.toISOString().slice(0, 10)).toBe('2026-11-01');
  });

  test('a primeira subscrição conta a partir de hoje', () => {
    const agora = new Date('2026-08-01T00:00:00Z');
    expect(assinaturaService.novoValidoAte(null, 12, agora).toISOString().slice(0, 10)).toBe('2027-08-01');
  });
});

describe('Subscrição — descidas de plano', () => {
  test('não desce para um plano com menos lugares do que os ocupados', async () => {
    await prisma.company.update({
      where: { id: companyId },
      data: { plan: 'PRO', searchRank: planService.rankDoPlano('PRO') },
    });
    const ocupados = await assinaturaService.lugaresOcupados(companyId);
    const lugaresBase = planService.limite('BASE', 'lugaresIncluidos');
    expect(ocupados).toBeGreaterThan(lugaresBase);   // a premissa do teste

    const res = await auth(adminEmpresaToken).post('/api/assinatura/pedir').send({ plano: 'BASE' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain(String(ocupados));
  });

  test('o impedimento vem em código e números, não em frase montada', async () => {
    // Uma frase montada no servidor chega ao ecrã em português e fica em
    // português com a interface em inglês. O contrato é: código + dados.
    await prisma.company.update({
      where: { id: companyId },
      data: { plan: 'PRO', searchRank: planService.rankDoPlano('PRO') },
    });
    const res = await auth(adminEmpresaToken).get('/api/assinatura');
    const base = res.body.opcoes.find((o) => o.plano === 'BASE');
    expect(base.impedimento).toMatchObject({
      codigo: 'LUGARES_INSUFICIENTES',
      plano: 'BASE',
      lugares: planService.limite('BASE', 'lugaresIncluidos'),
    });
    expect(typeof base.impedimento.ocupados).toBe('number');
    // E o texto do servidor sai do MESMO objeto, para não poderem divergir.
    expect(assinaturaService.impedimentoEmTexto(base.impedimento))
      .toContain(String(base.impedimento.ocupados));
  });

  test('o estado diz o que cada degrau custa e o que impede lá chegar', async () => {
    const res = await auth(adminEmpresaToken).get('/api/assinatura');
    expect(res.status).toBe(200);
    expect(res.body.opcoes).toHaveLength(planService.ESCADA.length);
    for (const o of res.body.opcoes) {
      expect(o.preco.valorUsd).toBe(planService.preco(o.plano).valorUsd);
      expect(['SUBIR', 'DESCER', 'RENOVAR']).toContain(o.direcao);
    }
    expect(res.body.opcoes.filter((o) => o.atual)).toHaveLength(1);
  });
});

describe('Subscrição — fila da KIXIMA', () => {
  test('a cobrança com comprovativo aparece por confirmar', async () => {
    const cobranca = await pedirPro();
    await request(app)
      .post(`/api/assinatura/${cobranca.id}/comprovativo`)
      .set('Authorization', `Bearer ${adminEmpresaToken}`)
      .attach('comprovativo', COMPROVATIVO, 'transferencia.pdf');

    const res = await auth(adminSistemaToken).get('/api/assinatura/fila');
    expect(res.status).toBe(200);
    expect(res.body.porConfirmar).toBeGreaterThan(0);
    expect(res.body.emAberto.some((c) => c.id === cobranca.id)).toBe(true);
  });

  test('a fila é só da KIXIMA (403 para a empresa)', async () => {
    const res = await auth(adminEmpresaToken).get('/api/assinatura/fila');
    expect(res.status).toBe(403);
  });

  test('uma subscrição vencida aparece na fila em vez de descer o plano sozinha', async () => {
    const ontem = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    await prisma.company.update({ where: { id: companyId }, data: { plan: 'PRO', planoValidoAte: ontem } });

    const res = await auth(adminSistemaToken).get('/api/assinatura/fila');
    const vencida = res.body.vencidas.find((c) => c.id === companyId);
    expect(vencida).toBeTruthy();
    expect(vencida.diasVencida).toBeGreaterThanOrEqual(2);

    // O plano manteve-se: cortar o acesso sozinho a quem talvez já tenha
    // transferido é pior do que cobrar com atraso.
    const empresa = await prisma.company.findUnique({ where: { id: companyId } });
    expect(empresa.plan).toBe('PRO');
  });
});

describe('Subscrição — cancelamento', () => {
  test('exige motivo', async () => {
    const cobranca = await pedirPro();
    const res = await auth(adminEmpresaToken).post(`/api/assinatura/${cobranca.id}/cancelar`).send({});
    expect(res.status).toBe(422);
  });

  test('cancelada com motivo, e o motivo fica guardado', async () => {
    const cobranca = await pedirPro();
    const res = await auth(adminEmpresaToken)
      .post(`/api/assinatura/${cobranca.id}/cancelar`)
      .send({ motivo: 'Pedido por engano' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELADA');
    expect(res.body.notas).toBe('Pedido por engano');

    // E liberta o caminho para um novo pedido.
    const novo = await auth(adminEmpresaToken).post('/api/assinatura/pedir').send({ plano: 'CORE' });
    expect(novo.status).toBe(201);
  });
});

describe('Subscrição — dados bancários da KIXIMA', () => {
  // Sem IBAN a página emite cobranças e pede o comprovativo, mas não diz para
  // onde transferir. Não dá erro nenhum — só dinheiro que não chega.
  const original = { ...process.env };
  afterEach(() => { process.env = { ...original }; });

  test('sem IBAN diz que não está configurado', () => {
    delete process.env.KIXIMA_BANCO_IBAN;
    expect(assinaturaService.dadosBancarios().configurado).toBe(false);
  });

  test('com IBAN fica configurado e a moeda tem omissão', () => {
    process.env.KIXIMA_BANCO_IBAN = 'AO06 0000 0000 0000 0000 0000 0';
    delete process.env.KIXIMA_BANCO_MOEDA;
    const b = assinaturaService.dadosBancarios();
    expect(b.configurado).toBe(true);
    expect(b.moeda).toBe('USD');
  });

  test('um IBAN em branco conta como ausente', () => {
    process.env.KIXIMA_BANCO_IBAN = '   ';
    expect(assinaturaService.dadosBancarios().configurado).toBe(false);
  });

  test('o estado da empresa inclui os dados bancários', async () => {
    const res = await auth(adminEmpresaToken).get('/api/assinatura');
    expect(res.body.banco).toHaveProperty('configurado');
  });
});

describe('Subscrição — sessão', () => {
  test('sem token não se vê nada', async () => {
    expect((await request(app).get('/api/assinatura')).status).toBe(401);
  });
});

describe('Muro de plano — o caminho para a subscrição', () => {
  // O botão "Ver planos e subscrever" aparece porque o erro traz este CÓDIGO.
  // Se alguém o trocar por um BusinessRuleError comum, o muro continua a
  // funcionar e a interface deixa de dar saída — sem nada a partir-se.
  test('bater num limite devolve PLANO_INSUFICIENTE e o plano necessário', async () => {
    await prisma.company.update({
      where: { id: companyId },
      data: { plan: 'BASE', searchRank: planService.rankDoPlano('BASE') },
    });
    // A empresa tem 3 pessoas e o Base inclui 2 lugares.
    const res = await auth(adminEmpresaToken)
      .post('/api/companies/invites')
      .send({ role: 'COMPRADOR', name: 'Pessoa a mais', email: 'amais@petroangola.co.ao' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PLANO_INSUFICIENTE');
    expect(res.body.error.details.planoNecessario).toBe('CORE');
  });

  test('uma funcionalidade fora do plano diz QUAL plano a inclui', async () => {
    const forn = await prisma.user.findUnique({ where: { email: 'fornecedor@kianda.co.ao' } });
    await prisma.company.update({
      where: { id: forn.companyId },
      data: { plan: 'BASE', searchRank: planService.rankDoPlano('BASE') },
    });
    const tokenForn = await login('fornecedor@kianda.co.ao');
    const res = await auth(tokenForn).post('/api/catalog/api-keys').send({ nome: 'teste' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PLANO_INSUFICIENTE');
    // Calculado a partir da matriz, não escrito à mão: quando a API de catálogo
    // mudar de degrau, a mensagem muda com ela em vez de passar a mentir.
    expect(res.body.error.details.planoNecessario).toBe(planService.planoQueInclui('apiCatalogo'));

    await prisma.company.update({
      where: { id: forn.companyId },
      data: { plan: 'PRO', searchRank: planService.rankDoPlano('PRO') },
    });
  });
});

describe('Subscrição — renovar acima do limite', () => {
  // Uma empresa pode ficar acima do limite sem culpa (a KIXIMA baixou-lhe o
  // plano à mão). Se o teste de lugares travasse também a renovação, ela não
  // podia subir sem pagar nem pagar para ficar onde estava.
  test('renovar o plano atual não é travado pelos lugares ocupados', async () => {
    await prisma.company.update({
      where: { id: companyId },
      data: { plan: 'BASE', searchRank: planService.rankDoPlano('BASE') },
    });
    const ocupados = await assinaturaService.lugaresOcupados(companyId);
    expect(ocupados).toBeGreaterThan(planService.limite('BASE', 'lugaresIncluidos'));

    const res = await auth(adminEmpresaToken).get('/api/assinatura');
    const base = res.body.opcoes.find((o) => o.plano === 'BASE');
    expect(base.direcao).toBe('RENOVAR');
    expect(base.impedimento).toBeNull();

    // E o pedido passa mesmo.
    const pedido = await auth(adminEmpresaToken).post('/api/assinatura/pedir').send({ plano: 'BASE' });
    expect(pedido.status).toBe(201);
  });

  test('descer para um plano com menos lugares continua travado', async () => {
    await prisma.company.update({
      where: { id: companyId },
      data: { plan: 'CORE', searchRank: planService.rankDoPlano('CORE') },
    });
    const res = await auth(adminEmpresaToken).get('/api/assinatura');
    const base = res.body.opcoes.find((o) => o.plano === 'BASE');
    expect(base.direcao).toBe('DESCER');
    expect(base.impedimento?.codigo).toBe('LUGARES_INSUFICIENTES');
  });
});

// --- Segunda fase: expiração, período de tolerância, avisos escalonados ----
//
// O que a auditoria encontrou: planoValidoAte não tinha NENHUM efeito prático
// em lado nenhum além de um texto na própria página. Estes testes protegem a
// política nova — RESTRITA bloqueia só recursos premium/lugares, nunca dados;
// GRACE não bloqueia nada; os avisos escalonam sem repetir.
describe('Subscrição — patamar de urgência (estadoSubscricao)', () => {
  test('sem planoValidoAte: ATIVA (nunca cobrada, ou posta num plano à mão)', () => {
    expect(planService.estadoSubscricao({ planoValidoAte: null })).toBe('ATIVA');
  });

  test('longe do prazo: ATIVA', () => {
    expect(planService.estadoSubscricao({ planoValidoAte: hoje(40) }, new Date())).toBe('ATIVA');
  });

  test('dentro do limiar de aviso mas ainda paga: A_EXPIRAR', () => {
    expect(planService.estadoSubscricao({ planoValidoAte: hoje(15) }, new Date())).toBe('A_EXPIRAR');
  });

  test('vencida mas dentro da tolerância: GRACE', () => {
    expect(planService.estadoSubscricao({ planoValidoAte: hoje(-3) }, new Date())).toBe('GRACE');
  });

  test('fronteira exata do período de tolerância ainda é GRACE', () => {
    const v = hoje(-planService.GRACE_PERIOD_DAYS);
    expect(planService.estadoSubscricao({ planoValidoAte: v }, new Date())).toBe('GRACE');
  });

  test('um dia além da tolerância: RESTRITA', () => {
    const v = hoje(-(planService.GRACE_PERIOD_DAYS + 1));
    expect(planService.estadoSubscricao({ planoValidoAte: v }, new Date())).toBe('RESTRITA');
  });
});

describe('Subscrição — RESTRITA bloqueia recursos premium e lugares (nunca dados)', () => {
  afterEach(async () => {
    // O plano BASE/PRO e planoValidoAte já são repostos pelo beforeEach global
    // (linha ~36); só o campo novo desta fase precisa de reposição própria.
    await prisma.company.update({ where: { id: companyId }, data: { ultimoAvisoSubscricaoTier: null } });
  });

  test('convidar mais gente é recusado com PLANO_INSUFICIENTE quando RESTRITA — mesmo com lugares de sobra', async () => {
    await prisma.company.update({
      where: { id: companyId },
      // PRO tem lugares ilimitados — se isto bloquear, é mesmo a expiração, não os lugares.
      data: { plan: 'PRO', searchRank: planService.rankDoPlano('PRO'), planoValidoAte: hoje(-(planService.GRACE_PERIOD_DAYS + 1)) },
    });
    const res = await auth(adminEmpresaToken)
      .post('/api/companies/invites')
      .send({ role: 'COMPRADOR', name: 'Convite bloqueado', email: 'bloqueado@petroangola.co.ao' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PLANO_INSUFICIENTE');
  });

  test('ainda em período de tolerância, convidar continua a funcionar', async () => {
    await prisma.company.update({
      where: { id: companyId },
      data: { plan: 'PRO', searchRank: planService.rankDoPlano('PRO'), planoValidoAte: hoje(-2) },
    });
    const res = await auth(adminEmpresaToken)
      .post('/api/companies/invites')
      .send({ role: 'COMPRADOR', name: 'Convite em grace', email: 'grace@petroangola.co.ao' });

    expect(res.status).toBe(201);
  });

  test('uma funcionalidade premium (API de catálogo) fica bloqueada quando RESTRITA — mesmo com o plano PRO', async () => {
    const forn = await prisma.user.findUnique({ where: { email: 'fornecedor@kianda.co.ao' } });
    const original = await prisma.company.findUnique({ where: { id: forn.companyId } });
    await prisma.company.update({
      where: { id: forn.companyId },
      data: { plan: 'PRO', searchRank: planService.rankDoPlano('PRO'), planoValidoAte: hoje(-(planService.GRACE_PERIOD_DAYS + 1)) },
    });
    try {
      const tokenForn = await login('fornecedor@kianda.co.ao');
      const res = await auth(tokenForn).post('/api/catalog/api-keys').send({ nome: 'teste-restrita' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('PLANO_INSUFICIENTE');
      expect(res.body.error.message).toMatch(/vencida/);
    } finally {
      await prisma.company.update({
        where: { id: forn.companyId },
        data: { plan: original.plan, searchRank: original.searchRank, planoValidoAte: original.planoValidoAte, ultimoAvisoSubscricaoTier: null },
      });
    }
  });

  test('a mesma funcionalidade funciona normalmente em GRACE (só RESTRITA bloqueia)', async () => {
    const forn = await prisma.user.findUnique({ where: { email: 'fornecedor@kianda.co.ao' } });
    const original = await prisma.company.findUnique({ where: { id: forn.companyId } });
    await prisma.company.update({
      where: { id: forn.companyId },
      data: { plan: 'PRO', searchRank: planService.rankDoPlano('PRO'), planoValidoAte: hoje(-1) },
    });
    try {
      const tokenForn = await login('fornecedor@kianda.co.ao');
      const res = await auth(tokenForn).post('/api/catalog/api-keys').send({ nome: 'teste-grace' });
      expect(res.status).toBe(201);
    } finally {
      await prisma.apiKey.deleteMany({ where: { companyId: forn.companyId, nome: 'teste-grace' } });
      await prisma.company.update({
        where: { id: forn.companyId },
        data: { plan: original.plan, searchRank: original.searchRank, planoValidoAte: original.planoValidoAte, ultimoAvisoSubscricaoTier: null },
      });
    }
  });
});

describe('Subscrição — avisos escalonados de expiração', () => {
  let adminUserId;
  let financeiroUserId;

  beforeAll(async () => {
    adminUserId = (await prisma.user.findUnique({ where: { email: 'admin@petroangola.co.ao' } })).id;
    financeiroUserId = (await prisma.user.findUnique({ where: { email: 'financeiro@petroangola.co.ao' } })).id;
  });

  afterEach(async () => {
    await prisma.notification.deleteMany({ where: { type: 'SUBSCRICAO_A_EXPIRAR', userId: { in: [adminUserId, financeiroUserId] } } });
    await prisma.company.update({ where: { id: companyId }, data: { ultimoAvisoSubscricaoTier: null } });
  });

  test('a 15 dias do fim, avisa no patamar D30 (o único já ultrapassado) e regista o patamar', async () => {
    await prisma.company.update({ where: { id: companyId }, data: { planoValidoAte: hoje(15) } });
    const enviados = await assinaturaService.enviarAvisosDeExpiracao();
    expect(enviados).toBeGreaterThanOrEqual(1);

    const notif = await prisma.notification.findFirst({ where: { type: 'SUBSCRICAO_A_EXPIRAR', userId: adminUserId } });
    expect(notif).toBeTruthy();
    const empresa = await prisma.company.findUnique({ where: { id: companyId } });
    expect(empresa.ultimoAvisoSubscricaoTier).toBe('D30');
  });

  test('correr outra vez no mesmo dia não repete o aviso (sem spam)', async () => {
    await prisma.company.update({ where: { id: companyId }, data: { planoValidoAte: hoje(15) } });
    await assinaturaService.enviarAvisosDeExpiracao();
    const antes = await prisma.notification.count({ where: { type: 'SUBSCRICAO_A_EXPIRAR', userId: adminUserId } });

    await assinaturaService.enviarAvisosDeExpiracao();
    const depois = await prisma.notification.count({ where: { type: 'SUBSCRICAO_A_EXPIRAR', userId: adminUserId } });
    expect(depois).toBe(antes);
  });

  test('um cron atrasado avança direto para o patamar mais urgente já alcançado', async () => {
    // Nunca avisado (tier null) e já a 1 dia do fim — salta D30/D7/D3 e avisa
    // logo D1, em vez de os repetir todos de uma vez ou ficar preso no D30.
    await prisma.company.update({ where: { id: companyId }, data: { planoValidoAte: hoje(1) } });
    await assinaturaService.enviarAvisosDeExpiracao();
    const empresa = await prisma.company.findUnique({ where: { id: companyId } });
    expect(empresa.ultimoAvisoSubscricaoTier).toBe('D1');
    expect(await prisma.notification.count({ where: { type: 'SUBSCRICAO_A_EXPIRAR', userId: adminUserId } })).toBe(1);
  });

  test('avança de patamar quando o tempo passa (D7 depois de já ter avisado D30)', async () => {
    await prisma.company.update({ where: { id: companyId }, data: { planoValidoAte: hoje(15), ultimoAvisoSubscricaoTier: 'D30' } });
    await assinaturaService.enviarAvisosDeExpiracao();
    let empresa = await prisma.company.findUnique({ where: { id: companyId } });
    // Ainda no mesmo patamar (15 dias > 7) — não avisa de novo.
    expect(empresa.ultimoAvisoSubscricaoTier).toBe('D30');

    await prisma.company.update({ where: { id: companyId }, data: { planoValidoAte: hoje(5) } });
    await assinaturaService.enviarAvisosDeExpiracao();
    empresa = await prisma.company.findUnique({ where: { id: companyId } });
    expect(empresa.ultimoAvisoSubscricaoTier).toBe('D7');
  });

  test('empresa RESTRITA não recebe mais avisos — já está bloqueada nos pontos certos', async () => {
    await prisma.company.update({
      where: { id: companyId },
      data: { planoValidoAte: hoje(-(planService.GRACE_PERIOD_DAYS + 3)), ultimoAvisoSubscricaoTier: 'GRACE_META' },
    });
    const enviados = await assinaturaService.enviarAvisosDeExpiracao();
    const empresa = await prisma.company.findUnique({ where: { id: companyId } });
    // O patamar não muda para esta empresa (pode mudar noutras candidatas).
    expect(empresa.ultimoAvisoSubscricaoTier).toBe('GRACE_META');
    expect(enviados).toBeGreaterThanOrEqual(0);
    const notifDepois = await prisma.notification.count({ where: { type: 'SUBSCRICAO_A_EXPIRAR', userId: adminUserId } });
    expect(notifDepois).toBe(0);
  });

  test('confirmar uma renovação reinicia o patamar — o próximo ciclo começa do zero', async () => {
    await prisma.company.update({ where: { id: companyId }, data: { ultimoAvisoSubscricaoTier: 'GRACE_INICIO' } });
    const cobranca = await pedirPro();
    await request(app)
      .post(`/api/assinatura/${cobranca.id}/comprovativo`)
      .set('Authorization', `Bearer ${adminEmpresaToken}`)
      .attach('comprovativo', COMPROVATIVO, 'transferencia.pdf');
    await auth(adminSistemaToken).post(`/api/assinatura/${cobranca.id}/confirmar`).send({});

    const empresa = await prisma.company.findUnique({ where: { id: companyId } });
    expect(empresa.ultimoAvisoSubscricaoTier).toBeNull();
  });
});

describe('Subscrição — fila separa período de tolerância de restritas', () => {
  afterEach(async () => {
    await prisma.company.update({ where: { id: companyId }, data: { ultimoAvisoSubscricaoTier: null } });
  });

  test('em GRACE aparece em emGrace, não em restritas', async () => {
    await prisma.company.update({ where: { id: companyId }, data: { plan: 'PRO', planoValidoAte: hoje(-2) } });
    const res = await auth(adminSistemaToken).get('/api/assinatura/fila');
    expect(res.body.emGrace.some((c) => c.id === companyId)).toBe(true);
    expect(res.body.restritas.some((c) => c.id === companyId)).toBe(false);
  });

  test('além da tolerância aparece em restritas, não em emGrace', async () => {
    await prisma.company.update({
      where: { id: companyId },
      data: { plan: 'PRO', planoValidoAte: hoje(-(planService.GRACE_PERIOD_DAYS + 1)) },
    });
    const res = await auth(adminSistemaToken).get('/api/assinatura/fila');
    expect(res.body.restritas.some((c) => c.id === companyId)).toBe(true);
    expect(res.body.emGrace.some((c) => c.id === companyId)).toBe(false);
  });
});
