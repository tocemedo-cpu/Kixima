// tests/dados-pessoais.test.js
// Direitos do titular dos dados (Lei n.º 22/11).
//
// O ponto que estes testes protegem é a tensão central do desenho: o titular
// pode pedir para ser esquecido, mas o trilho de auditoria financeira TEM de
// sobreviver — é o registo de quem aprovou que ordem e quem autorizou que
// pagamento. Apagar a linha do utilizador destruiria a contabilidade e deixaria
// ordens sem autor. Por isso a eliminação é uma ANONIMIZAÇÃO.
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { loginAll, auth, prisma, PASSWORD } = require('./helpers');

describe('Dados pessoais', () => {
  let tokens;
  beforeAll(async () => { tokens = await loginAll(); });

  describe('aceder', () => {
    test('o titular obtém tudo o que a plataforma sabe sobre si', async () => {
      const res = await auth(tokens.comprador).get('/api/users/me/dados-pessoais');
      expect(res.status).toBe(200);
      expect(res.body.conta.email).toBeTruthy();
      expect(res.body.atividade).toHaveProperty('ordensCriadas');
      expect(res.body.atividade).toHaveProperty('registoDeAcoes');
      expect(res.body.totais).toHaveProperty('ordensCriadas');
    });

    test('o documento vem como ficheiro para descarregar', async () => {
      const res = await auth(tokens.comprador).get('/api/users/me/dados-pessoais');
      expect(res.headers['content-disposition']).toMatch(/attachment; filename="kixima-dados-/);
    });

    test('sem sessão não se acede aos dados de ninguém', async () => {
      expect((await request(app).get('/api/users/me/dados-pessoais')).status).toBe(401);
    });
  });

  describe('eliminar', () => {
    let vitima;

    beforeEach(async () => {
      const empresa = await prisma.company.findFirst({ where: { type: 'CLIENTE' } });
      vitima = await prisma.user.create({
        data: {
          name: 'Pessoa a Esquecer',
          email: `esquecer-${Date.now()}@petroangola.co.ao`,
          passwordHash: await bcrypt.hash('Tubo-Flexivel-55', 12),
          role: 'COMPRADOR',
          companyId: empresa.id,
          locale: 'fr',
        },
      });
      // Deixa rasto: um registo de auditoria e uma notificação.
      await prisma.auditLog.create({
        data: { action: 'PO_APROVADA', entityType: 'PurchaseOrder', actorId: vitima.id, actorName: vitima.name },
      });
      await prisma.notification.create({
        data: { userId: vitima.id, type: 'PO_APROVADA', channel: 'IN_APP', title: 'Aviso', message: 'Pessoal' },
      });
    });

    async function tokenDaVitima() {
      const r = await request(app).post('/api/auth/login').send({ email: vitima.email, password: 'Tubo-Flexivel-55' });
      return r.body.token;
    }

    test('exige a senha atual — é irreversível', async () => {
      const res = await auth(await tokenDaVitima())
        .post('/api/users/me/anonimizar')
        .send({ password: 'senha-errada' });
      expect(res.status).toBe(422);
      expect(res.body.error.message).toMatch(/senha atual/i);

      const intacto = await prisma.user.findUnique({ where: { id: vitima.id } });
      expect(intacto.name).toBe('Pessoa a Esquecer');
    });

    test('remove o que identifica a pessoa e fecha a conta', async () => {
      const res = await auth(await tokenDaVitima())
        .post('/api/users/me/anonimizar')
        .send({ password: 'Tubo-Flexivel-55', motivo: 'Pedido do titular' });
      expect(res.status).toBe(200);

      const depois = await prisma.user.findUnique({ where: { id: vitima.id } });
      expect(depois.name).toBe('Utilizador anonimizado');
      expect(depois.email).not.toContain('esquecer-');
      expect(depois.email).toMatch(/@anonimo\.kixima$/);
      expect(depois.locale).toBeNull();
      expect(depois.active).toBe(false);
    });

    // O ponto mais importante de todos.
    test('o trilho de auditoria SOBREVIVE, sem o nome da pessoa', async () => {
      const res = await auth(await tokenDaVitima())
        .post('/api/users/me/anonimizar')
        .send({ password: 'Tubo-Flexivel-55' });
      expect(res.body.registosDeAuditoriaPreservados).toBeGreaterThan(0);

      // Procura-se a linha, não se assume a posição: sem ORDER BY o Postgres não
      // promete ordem nenhuma, e uma asserção em trilho[0] passa ou falha
      // conforme o plano de execução do dia.
      const trilho = await prisma.auditLog.findMany({
        where: { actorId: vitima.id },
        orderBy: { createdAt: 'asc' },
      });
      expect(trilho.length).toBeGreaterThan(0);          // o registo não se apaga
      const aprovacao = trilho.find((r) => r.action === 'PO_APROVADA');
      expect(aprovacao).toBeTruthy();                     // continua a dizer o que aconteceu
      expect(aprovacao.actorName).toBe('Utilizador anonimizado'); // sem identificar quem
      // E TODAS as linhas dela ficam sem nome, não só a que se foi buscar.
      expect(trilho.every((r) => r.actorName === 'Utilizador anonimizado')).toBe(true);
    });

    test('a correspondência pessoal é eliminada', async () => {
      const res = await auth(await tokenDaVitima())
        .post('/api/users/me/anonimizar')
        .send({ password: 'Tubo-Flexivel-55' });
      expect(res.body.notificacoesEliminadas).toBeGreaterThan(0);
      expect(await prisma.notification.count({ where: { userId: vitima.id } })).toBe(0);
    });

    test('a sessão deixa de valer imediatamente', async () => {
      const token = await tokenDaVitima();
      await auth(token).post('/api/users/me/anonimizar').send({ password: 'Tubo-Flexivel-55' });
      expect((await auth(token).get('/api/auth/me')).status).toBe(401);
    });

    test('e não se volta a entrar com as credenciais antigas', async () => {
      await auth(await tokenDaVitima()).post('/api/users/me/anonimizar').send({ password: 'Tubo-Flexivel-55' });
      const res = await request(app).post('/api/auth/login').send({ email: vitima.email, password: 'Tubo-Flexivel-55' });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  test('a senha das contas de teste não muda com isto', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'comprador@petroangola.co.ao', password: PASSWORD });
    expect(res.status).toBe(200);
  });
});
