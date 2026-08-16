// tests/subscricoes-em-lote.test.js
// A subscrição de N empresas custa o mesmo que a de uma (KX2-04).
//
// O QUE ISTO PROTEGE não é o resultado — é o CUSTO. O ecrã de Planos do Admin
// do Sistema pedia a subscrição de cada empresa, uma a uma: duas empresas de
// demonstração, dois pedidos, tudo aparentemente bem. Com duzentas eram ~204
// pedidos HTTP por abertura da página, e o limitador da própria plataforma
// (600 por 15 minutos e por utilizador) trancava o Admin ao TERCEIRO
// carregamento — com a mensagem "demasiados pedidos", que não aponta para aqui.
//
// Um teste que só verifique os números devolvidos passa igualmente bem com a
// versão N+1 e com a versão em lote. Por isso estes testes CONTAM CONSULTAS: é
// a única forma de a regressão voltar a ser vermelha em vez de silenciosa.

const { auth, prisma, loginAll } = require('./helpers');
const companyService = require('../src/services/companyService');

let tokens;
beforeAll(async () => { tokens = await loginAll(); });
afterAll(async () => { await prisma.$disconnect(); });

describe('O custo não cresce com o número de empresas', () => {
  test('a contagem de utilizadores é UMA consulta, seja qual for o número de empresas', async () => {
    const espiaCount = jest.spyOn(prisma.user, 'count');
    const espiaGroup = jest.spyOn(prisma.user, 'groupBy');
    try {
      const empresas = await prisma.company.findMany({
        select: { id: true, name: true, type: true, size: true, plan: true, seatPriceUsd: true, employees: true, annualRevenueUsd: true, planNotes: true },
      });
      expect(empresas.length).toBeGreaterThan(1); // senão o teste não exercita nada

      espiaCount.mockClear(); espiaGroup.mockClear();
      const subs = await companyService.subscriptionsFor(empresas);

      // O sinal da avaria antiga: uma contagem POR empresa.
      expect(espiaCount).toHaveBeenCalledTimes(0);
      expect(espiaGroup).toHaveBeenCalledTimes(1);
      expect(subs.size).toBe(empresas.length);
    } finally {
      espiaCount.mockRestore(); espiaGroup.mockRestore();
    }
  });

  test('uma empresa sem utilizadores ativos conta ZERO, e não desaparece', async () => {
    // O `groupBy` não devolve linha para quem não tem nada — se isso não for
    // tratado, a empresa perde o custo mensal no ecrã em vez de o ter a zero.
    const empresa = await prisma.company.create({
      data: {
        name: 'Empresa Sem Gente Lda',
        taxId: `TESTE-${Date.now()}`,
        type: 'FORNECEDOR',
        contactEmail: 'sem@gente.co.ao',
        status: 'APROVADA',
      },
      select: { id: true, name: true, type: true, size: true, plan: true, seatPriceUsd: true, employees: true, annualRevenueUsd: true, planNotes: true },
    });
    try {
      const subs = await companyService.subscriptionsFor([empresa]);
      const s = subs.get(empresa.id);
      expect(s).toBeDefined();
      expect(s.activeUsers).toBe(0);
      expect(s.monthly).toBeDefined();
    } finally {
      await prisma.company.delete({ where: { id: empresa.id } });
    }
  });

  test('sem empresas nenhumas, não faz consulta nenhuma', async () => {
    const espia = jest.spyOn(prisma.user, 'groupBy');
    try {
      const subs = await companyService.subscriptionsFor([]);
      expect(subs.size).toBe(0);
      expect(espia).toHaveBeenCalledTimes(0);
    } finally { espia.mockRestore(); }
  });
});

describe('A listagem só traz a subscrição quando é pedida', () => {
  test('sem o parâmetro, a resposta é a de sempre', async () => {
    const res = await auth(tokens.adminSistema).get('/api/companies');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Quem só quer a lista não deve pagar a consulta de contagem.
    expect(res.body[0].subscricao).toBeUndefined();
  });

  test('com o parâmetro, cada empresa traz a sua subscrição no MESMO pedido', async () => {
    const res = await auth(tokens.adminSistema).get('/api/companies?comSubscricao=true');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(1);
    for (const c of res.body) {
      expect(c.subscricao).toBeTruthy();
      expect(typeof c.subscricao.activeUsers).toBe('number');
      expect(c.subscricao.monthly).toBeDefined();
      expect(c.subscricao.company.id).toBe(c.id);
    }
  });

  test('os números em lote batem certo com os do endpoint individual', async () => {
    // Duas implementações do mesmo cálculo divergem, e a que diverge é sempre
    // a que menos gente lê. Aqui a singular é construída SOBRE a de lote — este
    // teste é o que garante que continua a ser.
    const lista = await auth(tokens.adminSistema).get('/api/companies?comSubscricao=true');
    const primeira = lista.body[0];
    const individual = await auth(tokens.adminSistema).get(`/api/companies/${primeira.id}/subscription`);

    expect(individual.status).toBe(200);
    expect(individual.body.activeUsers).toBe(primeira.subscricao.activeUsers);
    expect(individual.body.monthly).toEqual(primeira.subscricao.monthly);
    expect(individual.body.requiredPlan).toBe(primeira.subscricao.requiredPlan);
  });

  test('um valor estranho no parâmetro não liga a subscrição por acidente', async () => {
    // `?comSubscricao=1` ou `=sim` não é "true". Aceitar qualquer valor
    // verdadeiro faria a consulta pesada disparar por engano.
    for (const valor of ['1', 'sim', 'yes', 'false', '']) {
      const r = await auth(tokens.adminSistema).get(`/api/companies?comSubscricao=${valor}`);
      expect(r.body[0].subscricao).toBeUndefined();
    }
  });
});
