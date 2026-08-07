// tests/session-revocation.test.js
// Revogação de sessão server-side (tokenVersion): logout global e troca de
// senha invalidam imediatamente os JWT já emitidos. Usa um utilizador dedicado
// para não interferir com as outras suites.
const bcrypt = require('bcryptjs');
const { request, app, prisma, auth, login } = require('./helpers');

const EMAIL = 'sessao.teste@terceira.co.ao';
const PW = 'Kixima@123';
const NEW_PW = 'NovaSenha@1';
let companyId;

beforeAll(async () => {
  const company = await prisma.company.create({
    data: {
      name: 'Empresa Sessão Lda', taxId: `TAX-SESS-${Date.now()}`, type: 'CLIENTE',
      status: 'APROVADA', contactEmail: 'geral@sessao.co.ao',
    },
  });
  companyId = company.id;
  const passwordHash = await bcrypt.hash(PW, 12);
  await prisma.user.create({
    data: { name: 'Utilizador Sessão', email: EMAIL, passwordHash, role: 'COMPANY_ADMIN', companyId, active: true },
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.company.deleteMany({ where: { id: companyId } });
  await prisma.$disconnect();
});

describe('Revogação de sessão (tokenVersion)', () => {
  test('logout invalida o token atual; um novo login volta a funcionar', async () => {
    const token = await login(EMAIL);
    // O token funciona.
    expect((await auth(token).get('/api/auth/me')).status).toBe(200);
    // Logout global (revoga as sessões).
    expect((await auth(token).post('/api/auth/logout')).status).toBe(200);
    // O mesmo token deixou de ser aceite.
    expect((await auth(token).get('/api/auth/me')).status).toBe(401);
    // Novo login → novo token válido.
    const token2 = await login(EMAIL);
    expect((await auth(token2).get('/api/auth/me')).status).toBe(200);
  });

  test('trocar a senha invalida os tokens anteriores', async () => {
    const token = await login(EMAIL);
    expect((await auth(token).get('/api/auth/me')).status).toBe(200);
    const chg = await auth(token)
      .patch('/api/auth/password')
      .send({ currentPassword: PW, newPassword: NEW_PW });
    expect(chg.status).toBe(200);
    // O token emitido antes da troca deixou de ser válido.
    expect((await auth(token).get('/api/auth/me')).status).toBe(401);
    // Login com a nova senha funciona.
    const res = await request(app).post('/api/auth/login').send({ email: EMAIL, password: NEW_PW });
    expect(res.status).toBe(200);
  });
});
