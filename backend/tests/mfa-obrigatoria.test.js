// tests/mfa-obrigatoria.test.js
// 2FA obrigatória para quem aprova dinheiro e credencia empresas.
//
// O ponto delicado deste desenho: NÃO se pode barrar o login de quem ainda não
// configurou a 2FA, porque configurá-la exige estar dentro da aplicação. Quem o
// faz tranca os próprios administradores fora e só se sai daí mexendo na base à
// mão. Por isso a sessão é emitida na mesma, mas restrita ao necessário para
// ativar a 2FA.
const request = require('supertest');
const app = require('../src/app');
const config = require('../src/config/env');
const mfaPolicy = require('../src/services/mfaPolicy');
const { loginAll, auth, PASSWORD, USERS } = require('./helpers');

describe('2FA obrigatória', () => {
  const prazoOriginal = config.auth.mfaEnforceFrom;
  afterEach(() => { config.auth.mfaEnforceFrom = prazoOriginal; });

  describe('quem é abrangido', () => {
    test('os perfis que aprovam dinheiro ou credenciam empresas', () => {
      expect(mfaPolicy.exigeMfa('ADMIN_SISTEMA')).toBe(true);
      expect(mfaPolicy.exigeMfa('COMPANY_ADMIN')).toBe(true);
    });
    test('os restantes não são obrigados', () => {
      for (const r of ['COMPRADOR', 'FORNECEDOR', 'FINANCEIRO']) {
        expect(mfaPolicy.exigeMfa(r)).toBe(false);
      }
    });
  });

  describe('antes do prazo — avisa, não bloqueia', () => {
    beforeEach(() => { config.auth.mfaEnforceFrom = new Date('2099-01-01'); });

    test('o Company Admin entra e a sessão diz que falta ativar', async () => {
      const res = await request(app).post('/api/auth/login').send({ email: USERS.companyAdmin, password: PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body.mfaPendente).toBe(true);
      expect(res.body.mfaRestrita).toBe(false);
    });

    test('e continua a usar a plataforma normalmente', async () => {
      const token = (await request(app).post('/api/auth/login').send({ email: USERS.companyAdmin, password: PASSWORD })).body.token;
      const res = await auth(token).get('/api/company-admin/dashboard');
      expect(res.status).toBe(200);
    });
  });

  describe('depois do prazo — sessão restrita', () => {
    let token;
    beforeEach(async () => {
      config.auth.mfaEnforceFrom = null; // entra sem restrição para obter o token
      token = (await request(app).post('/api/auth/login').send({ email: USERS.companyAdmin, password: PASSWORD })).body.token;
      config.auth.mfaEnforceFrom = new Date('2000-01-01'); // prazo já passou
    });

    test('o resto da plataforma fica fechado, com a razão à frente', async () => {
      const res = await auth(token).get('/api/company-admin/dashboard');
      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/dois passos/i);
      expect(res.body.error.message).toMatch(/Segurança/);
    });

    test('mas consegue chegar ao que precisa para ativar a 2FA', async () => {
      // Sem estes caminhos abertos, a conta ficava presa: para ativar a 2FA é
      // preciso estar autenticado.
      expect((await auth(token).get('/api/auth/me')).status).toBe(200);
      expect((await auth(token).get('/api/auth/2fa/status')).status).toBe(200);
      expect((await auth(token).post('/api/auth/2fa/setup')).status).toBeLessThan(300);
    });

    test('e pode sempre terminar a sessão', async () => {
      expect((await auth(token).post('/api/auth/logout')).status).toBe(200);
    });

    test('quem não é abrangido não é afetado', async () => {
      const tokens = await loginAll();
      expect((await auth(tokens.comprador).get('/api/buyer/orders')).status).toBe(200);
    });
  });

  describe('sem prazo definido', () => {
    test('nunca bloqueia — fica só o aviso', async () => {
      config.auth.mfaEnforceFrom = null;
      const res = await request(app).post('/api/auth/login').send({ email: USERS.companyAdmin, password: PASSWORD });
      expect(res.body.mfaPendente).toBe(true);
      expect(res.body.mfaRestrita).toBe(false);
      expect((await auth(res.body.token).get('/api/company-admin/dashboard')).status).toBe(200);
    });
  });
});
