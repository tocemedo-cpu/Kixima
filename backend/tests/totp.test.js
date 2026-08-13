// tests/totp.test.js
// 2FA (TOTP): ativação em 2 passos, login em 2 passos, desativação com código.
// Os códigos válidos são calculados com o mesmo utilitário RFC 6238 do servidor.
const { request, app, prisma, login, PASSWORD } = require('./helpers');
const totp = require('../src/utils/totp');

const EMAIL = 'comprador@petroangola.co.ao';

// Garante que a suite deixa a conta partilhada como a encontrou (sem 2FA).
afterAll(async () => {
  await prisma.user.update({ where: { email: EMAIL }, data: { totpSecret: null, totpEnabledAt: null } });
  await prisma.$disconnect();
});

const authed = (token) => ({
  get: (p) => request(app).get(p).set('Authorization', `Bearer ${token}`),
  post: (p) => request(app).post(p).set('Authorization', `Bearer ${token}`),
});

describe('Autenticação de dois fatores (TOTP)', () => {
  test('o utilitário TOTP gera códigos estáveis e verifica com janela ±1', () => {
    const secret = totp.generateSecret();
    const at = 1_700_000_000_000;
    const code = totp.totp(secret, { at });
    expect(code).toMatch(/^\d{6}$/);
    // Mesmo passo → verifica; passo vizinho (30s) → ainda verifica; 2 passos → não.
    expect(totp.verify(code, secret, { at })).toBe(true);
    expect(totp.verify(code, secret, { at: at + 30_000 })).toBe(true);
    expect(totp.verify(code, secret, { at: at + 90_000 })).toBe(false);
    expect(totp.verify('000000', secret, { at })).toBe(false);
  });

  test('fluxo completo: setup → enable → login pede 2FA → verify entra → disable', async () => {
    const token = await login(EMAIL);

    // Estado inicial: desativado.
    const st0 = await authed(token).get('/api/auth/2fa/status');
    expect(st0.body.enabled).toBe(false);

    // Setup: devolve segredo + otpauth URL; ainda NÃO ativa.
    const setup = await authed(token).post('/api/auth/2fa/setup');
    expect(setup.status).toBe(200);
    expect(setup.body.secret).toMatch(/^[A-Z2-7]+$/);
    expect(setup.body.otpauthUrl).toContain('otpauth://totp/');
    const st1 = await authed(token).get('/api/auth/2fa/status');
    expect(st1.body.enabled).toBe(false);

    // Ativar com código errado → 401; com código certo → ativo.
    const bad = await authed(token).post('/api/auth/2fa/enable').send({ code: '000000' });
    expect(bad.status).toBe(401);
    const good = await authed(token).post('/api/auth/2fa/enable').send({ code: totp.totp(setup.body.secret) });
    expect(good.status).toBe(200);
    expect(good.body.enabled).toBe(true);

    // Login: senha certa deixa de dar token — devolve desafio.
    const step1 = await request(app).post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });
    expect(step1.status).toBe(200);
    expect(step1.body.requires2fa).toBe(true);
    expect(step1.body.token).toBeUndefined();

    // Verify com código errado → 401; com código certo → sessão completa.
    const wrong = await request(app).post('/api/auth/2fa/verify')
      .send({ challenge: step1.body.challenge, code: '123456' });
    expect(wrong.status).toBe(401);
    const ok = await request(app).post('/api/auth/2fa/verify')
      .send({ challenge: step1.body.challenge, code: totp.totp(setup.body.secret) });
    expect(ok.status).toBe(200);
    expect(typeof ok.body.token).toBe('string');
    expect(ok.body.user.email).toBe(EMAIL);

    // O token emitido funciona normalmente.
    const me = await authed(ok.body.token).get('/api/auth/me');
    expect(me.status).toBe(200);

    // A ativação ficou no trilho de auditoria.
    const log = await prisma.auditLog.findFirst({ where: { action: 'MFA_ATIVADA', entityId: ok.body.user.id } });
    expect(log).toBeTruthy();

    // Desativar exige código válido; depois o login volta a ser em 1 passo.
    const noDisable = await authed(ok.body.token).post('/api/auth/2fa/disable').send({ code: '999999' });
    expect(noDisable.status).toBe(401);
    const disabled = await authed(ok.body.token).post('/api/auth/2fa/disable')
      .send({ code: totp.totp(setup.body.secret) });
    expect(disabled.status).toBe(200);
    const direct = await request(app).post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });
    expect(direct.body.token).toBeTruthy();
  });

  test('um desafio adulterado ou de outro tipo é rejeitado', async () => {
    const res = await request(app).post('/api/auth/2fa/verify')
      .send({ challenge: 'x'.repeat(40), code: '123456' });
    expect(res.status).toBe(401);
  });
});

// O relógio do telemóvel fora de horas é a causa mais comum de "código
// incorreto" — e a mensagem antiga não dava pista nenhuma, o que levava as
// pessoas a reinstalar a app e a ler o QR outra vez, falhando na mesma porque o
// problema nunca esteve no segredo.
describe('Quando o código falha, a mensagem diz porquê', () => {
  const totpUtil = require('../src/utils/totp');
  const segredo = totpUtil.generateSecret();
  const agora = Date.now();

  test('desvio até ±30s continua a ser aceite — não é problema nenhum', () => {
    for (const seg of [0, 25, -25]) {
      expect(totpUtil.verify(totpUtil.totp(segredo, { at: agora + seg * 1000 }), segredo, { at: agora })).toBe(true);
    }
  });

  test('acima disso é recusado, mas diz o desvio e o sentido', () => {
    const adiantado = totpUtil.totp(segredo, { at: agora + 90 * 1000 });
    expect(totpUtil.verify(adiantado, segredo, { at: agora })).toBe(false);
    expect(totpUtil.explicarFalha(adiantado, segredo, { at: agora })).toMatch(/90 segundos adiantado/);

    const atrasado = totpUtil.totp(segredo, { at: agora - 300 * 1000 });
    expect(totpUtil.explicarFalha(atrasado, segredo, { at: agora })).toMatch(/300 segundos atrasado/);
  });

  // O ponto que não se pode perder: diagnosticar não é aceitar. Se o código
  // fosse aceite com o relógio errado, a pessoa ativava a 2FA e depois falhava
  // em TODOS os logins seguintes — o desvio tem de ser corrigido, não contornado.
  test('um desvio detetado NÃO faz o código passar', () => {
    const fora = totpUtil.totp(segredo, { at: agora + 120 * 1000 });
    expect(totpUtil.desvioDeRelogio(fora, segredo, { at: agora })).toBe(120);
    expect(totpUtil.verify(fora, segredo, { at: agora })).toBe(false);
  });

  test('um código que não bate em lado nenhum aponta para as entradas duplicadas', () => {
    expect(totpUtil.explicarFalha('123456', segredo, { at: agora })).toMatch(/mais do que uma vez/);
  });

  test('fora de ±10 minutos deixa de se procurar desvio', () => {
    const longe = totpUtil.totp(segredo, { at: agora + 900 * 1000 });
    expect(totpUtil.desvioDeRelogio(longe, segredo, { at: agora })).toBeNull();
  });

  test('a API devolve a explicação, não um "código incorreto" seco', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });
    const setup = await authed(login.body.token).post('/api/auth/2fa/setup');
    const desfasado = totpUtil.totp(setup.body.secret, { at: Date.now() + 120 * 1000 });

    const res = await authed(login.body.token).post('/api/auth/2fa/enable').send({ code: desfasado });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/relógio do seu telemóvel/);

    await prisma.user.update({ where: { email: EMAIL }, data: { totpSecret: null, totpEnabledAt: null } });
  });
});
