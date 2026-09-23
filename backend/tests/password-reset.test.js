// tests/password-reset.test.js
// Recuperação de senha ("Esqueci a senha"): pedido anti-enumeração, redefinição
// com token de uso único (via tokenVersion) e revogação das sessões antigas.
const { request, app, prisma, auth, login } = require('./helpers');
const notificationService = require('../src/services/notificationService');

const EMAIL = 'comprador@petroangola.co.ao';
const OLD_PASS = 'Kixima@123';
const NEW_PASS = 'NovaSenha#2026';

// Captura os emails enviados (sem os enviar de facto).
let sentEmails;
beforeEach(() => {
  sentEmails = [];
  jest.spyOn(notificationService, 'sendEmail').mockImplementation(async (to, subject, text, opts) => {
    sentEmails.push({ to, subject, text, opts });
  });
});
afterEach(() => jest.restoreAllMocks());

afterAll(async () => {
  // Repõe a senha original para não interferir com outras suites.
  const authService = require('../src/services/authService');
  const passwordHash = await authService.hashPassword(OLD_PASS);
  await prisma.user.update({ where: { email: EMAIL }, data: { passwordHash } });
  await prisma.$disconnect();
});

// Extrai o token do link /recuperar/<token> presente no corpo do email.
function tokenFromEmail() {
  const m = sentEmails[0]?.text.match(/\/recuperar\/([\w.-]+)/);
  return m?.[1];
}

describe('Recuperação de senha', () => {
  test('pedido devolve SEMPRE a mesma resposta, exista o email ou não (anti-enumeração)', async () => {
    const known = await request(app).post('/api/auth/forgot-password').send({ email: EMAIL });
    const unknown = await request(app).post('/api/auth/forgot-password').send({ email: 'ninguem@nada.co.ao' });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
    // Mas só o email existente recebe de facto a mensagem.
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].to).toBe(EMAIL);
    expect(sentEmails[0].text).toMatch(/\/recuperar\//);
  });

  test('fluxo completo: redefinir → senha antiga morre, nova entra, sessões antigas revogadas, token não reutilizável', async () => {
    // Sessão ativa ANTES do reset (para verificar a revogação).
    const oldToken = await login(EMAIL);

    await request(app).post('/api/auth/forgot-password').send({ email: EMAIL });
    const token = tokenFromEmail();
    expect(token).toBeTruthy();

    const reset = await request(app).post('/api/auth/reset-password').send({ token, password: NEW_PASS });
    expect(reset.status).toBe(200);

    // Senha antiga deixa de funcionar; a nova entra.
    const oldLogin = await request(app).post('/api/auth/login').send({ email: EMAIL, password: OLD_PASS });
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(app).post('/api/auth/login').send({ email: EMAIL, password: NEW_PASS });
    expect(newLogin.status).toBe(200);

    // As sessões antigas foram revogadas (tokenVersion incrementou).
    const meOld = await auth(oldToken).get('/api/auth/me');
    expect(meOld.status).toBe(401);

    // O mesmo token de recuperação NÃO pode ser reutilizado.
    const reuse = await request(app).post('/api/auth/reset-password').send({ token, password: 'OutraSenha#99' });
    expect(reuse.status).toBe(401);
  });

  test('token inválido é rejeitado (401)', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({ token: 'abc.def.ghi', password: NEW_PASS });
    expect(res.status).toBe(401);
  });

  test('senha curta é rejeitada (422)', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({ token: 'abc.def.ghi', password: '123' });
    expect(res.status).toBe(422);
  });

  test('perfil sensível (COMPANY_ADMIN): 11 caracteres chega para o mínimo geral mas não para o da própria conta (422)', async () => {
    const ADMIN_EMAIL = 'admin@petroangola.co.ao';
    await request(app).post('/api/auth/forgot-password').send({ email: ADMIN_EMAIL });
    const token = tokenFromEmail();
    expect(token).toBeTruthy();

    // 11 caracteres: passa no schema (mínimo genérico 10) mas COMPANY_ADMIN
    // exige 12 — só a validação a nível de serviço (que conhece o role da
    // conta do token) apanha isto.
    const res = await request(app).post('/api/auth/reset-password').send({ token, password: 'Curta12345#' });
    expect(res.status).toBe(422);

    // A senha do admin não mudou.
    const login = await request(app).post('/api/auth/login').send({ email: ADMIN_EMAIL, password: 'Kixima@123' });
    expect(login.status).toBe(200);
  });
});
