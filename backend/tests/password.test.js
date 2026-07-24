// tests/password.test.js
// Alteração de senha (Segurança).
const { request, app, auth, login, prisma, PASSWORD } = require('./helpers');

afterAll(async () => {
  // Repõe a senha original para não afetar outras suites (DB partilhada).
  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash(PASSWORD, 10);
  await prisma.user.update({ where: { email: 'financeiro@petroangola.co.ao' }, data: { passwordHash: hash } });
  await prisma.$disconnect();
});

describe('Segurança — alteração de senha', () => {
  const email = 'financeiro@petroangola.co.ao';
  const NEW = 'NovaSenha123';

  test('senha atual errada é rejeitada (401)', async () => {
    const token = await login(email);
    const res = await auth(token).patch('/api/auth/password').send({ currentPassword: 'errada-xyz', newPassword: NEW });
    expect(res.status).toBe(401);
  });

  test('altera a senha e passa a entrar com a nova', async () => {
    const token = await login(email);
    const res = await auth(token).patch('/api/auth/password').send({ currentPassword: PASSWORD, newPassword: NEW });
    expect(res.status).toBe(200);

    const relogin = await request(app).post('/api/auth/login').send({ email, password: NEW });
    expect(relogin.status).toBe(200);

    const oldLogin = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
    expect(oldLogin.status).toBe(401);
  });

  test('sem autenticação é rejeitado (401)', async () => {
    const res = await request(app).patch('/api/auth/password').send({ currentPassword: 'x', newPassword: NEW });
    expect(res.status).toBe(401);
  });
});
