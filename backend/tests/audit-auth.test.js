// tests/audit-auth.test.js
// A autenticação tem de deixar rasto.
//
// O trilho cobria as operações com dinheiro — pagamentos, aprovações, dados
// bancários — mas nada sobre quem entrou, de onde, ou quantas vezes falhou.
// Numa transação disputada conseguia-se provar o que aconteceu com a ordem, e
// não conseguia provar-se quem estava na conta.
const request = require('supertest');
const app = require('../src/app');
const { loginAll, auth, prisma, PASSWORD, USERS } = require('./helpers');

// Lê o registo mais recente de uma ação.
async function ultimo(action) {
  return prisma.auditLog.findFirst({ where: { action }, orderBy: { createdAt: 'desc' } });
}

describe('Trilho de auditoria — autenticação', () => {
  let tokens;
  beforeAll(async () => { tokens = await loginAll(); });

  test('o login com sucesso fica registado com quem, de onde e com que agente', async () => {
    await request(app)
      .post('/api/auth/login')
      .set('User-Agent', 'AgenteDeTeste/1.0')
      .send({ email: USERS.comprador, password: PASSWORD });

    const reg = await ultimo('LOGIN_SUCESSO');
    expect(reg).toBeTruthy();
    expect(reg.entityRef).toBe(USERS.comprador);
    expect(reg.actorId).toBeTruthy();
    expect(reg.actorRole).toBe('COMPRADOR');
    expect(reg.detail.agente).toMatch(/AgenteDeTeste/);
  });

  test('a tentativa falhada fica registada — é o primeiro sinal de um ataque', async () => {
    const antes = await ultimo('LOGIN_FALHADO');
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: USERS.comprador, password: 'senha-errada-de-proposito' });
    expect(res.status).toBe(401);

    const reg = await ultimo('LOGIN_FALHADO');
    expect(reg).toBeTruthy();
    expect(reg.id).not.toBe(antes?.id);
    expect(reg.entityRef).toBe(USERS.comprador);
    // Sem sessão não há ator — o que identifica a tentativa é a origem.
    expect(reg.actorId).toBeNull();
    expect(reg.detail.ip).toBeTruthy();
  });

  test('o registo da falha não revela se a conta existe', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nao-existe@nenhures.ao', password: 'seja-o-que-for-12' });
    expect(res.status).toBe(401);

    const reg = await ultimo('LOGIN_FALHADO');
    expect(reg.entityRef).toBe('nao-existe@nenhures.ao');
    // A resposta é indistinguível da de uma conta existente com senha errada.
    expect(res.body.error.message).not.toMatch(/não existe|inexistente/i);
  });

  test('mudar a senha e terminar sessões ficam registados', async () => {
    const nova = 'Flange-Soldada-31';
    const mudou = await auth(tokens.comprador)
      .patch('/api/auth/password')
      .send({ currentPassword: PASSWORD, newPassword: nova });
    expect(mudou.status).toBe(200);
    expect((await ultimo('SENHA_ALTERADA')).entityId).toBeTruthy();

    // A mudança revoga as sessões; entra-se de novo para terminar sessão.
    const novoToken = (await request(app).post('/api/auth/login').send({ email: USERS.comprador, password: nova })).body.token;
    await auth(novoToken).post('/api/auth/logout');
    expect(await ultimo('SESSOES_TERMINADAS')).toBeTruthy();

    // Repõe a senha original para não afetar as outras suites.
    const bcrypt = require('bcryptjs');
    await prisma.user.update({
      where: { email: USERS.comprador },
      data: { passwordHash: await bcrypt.hash(PASSWORD, 12) },
    });
  });

  test('o pedido de recuperação fica registado mesmo para contas que não existem', async () => {
    await request(app).post('/api/auth/forgot-password').send({ email: 'fantasma@nenhures.ao' });
    const reg = await ultimo('SENHA_RECUPERACAO_PEDIDA');
    expect(reg.entityRef).toBe('fantasma@nenhures.ao');
    expect(reg.detail.ip).toBeTruthy();
  });

  test('criar um utilizador fica registado com o perfil atribuído', async () => {
    const email = `auditado-${Date.now()}@petroangola.co.ao`;
    const res = await auth(tokens.companyAdmin).post('/api/companies/users').send({
      name: 'Utilizador Auditado', email, password: 'Guindaste-Movel-9', role: 'COMPRADOR',
    });
    expect(res.status).toBe(201);

    const reg = await ultimo('UTILIZADOR_CRIADO');
    expect(reg.entityRef).toBe(email);
    expect(reg.detail.perfil).toBe('COMPRADOR');
    expect(reg.actorRole).toBe('COMPANY_ADMIN');

    await prisma.user.deleteMany({ where: { email } });
  });
});
