// tests/auth.test.js
const { request, app, prisma, USERS, PASSWORD } = require('./helpers');

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Autenticação', () => {
  test('login com credenciais válidas devolve token e utilizador', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: USERS.comprador, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.length).toBeGreaterThan(20);
    expect(res.body.user.email).toBe(USERS.comprador);
    expect(res.body.user.role).toBe('COMPRADOR');
    // A password (hash) nunca deve sair na resposta.
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  test('login com password errada é rejeitado (401)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: USERS.comprador, password: 'password-errada' });

    expect(res.status).toBe(401);
  });

  test('login com email inexistente é rejeitado (401)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ninguem@kixima.co.ao', password: PASSWORD });

    expect(res.status).toBe(401);
  });

  test('corpo inválido é rejeitado pela validação (422)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nao-e-email' });

    expect(res.status).toBe(422);
  });

  test('endpoint protegido sem token devolve 401', async () => {
    const res = await request(app).get('/api/purchase-orders');
    expect(res.status).toBe(401);
  });

  test('endpoint protegido com token inválido devolve 401', async () => {
    const res = await request(app)
      .get('/api/purchase-orders')
      .set('Authorization', 'Bearer token-invalido');
    expect(res.status).toBe(401);
  });
});
