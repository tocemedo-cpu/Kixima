// tests/password-policy.test.js
// Política de senhas — a plataforma guarda dinheiro de terceiros, e 8 caracteres
// não chegam para uma conta que aprova ordens de compra.
//
// Regra de ouro destes testes: a política aplica-se a quem DEFINE ou MUDA uma
// senha, nunca ao login. Quem já tem uma senha curta continua a entrar — trancar
// utilizadores existentes seria trocar um risco por uma avaria.
const request = require('supertest');
const app = require('../src/app');
const politica = require('../src/utils/passwordPolicy');
const { loginAll, auth, PASSWORD, USERS } = require('./helpers');

describe('Política de senhas', () => {
  describe('regras', () => {
    test('o mínimo geral é 10 caracteres', () => {
      expect(politica.validar('Curta1')).toMatch(/pelo menos 10/);
      expect(politica.validar('Cabo-Umbilical')).toBeNull();
    });

    test('quem aprova dinheiro precisa de 12', () => {
      const dez = 'Valvula-42';
      expect(politica.validar(dez)).toBeNull();
      for (const role of ['COMPANY_ADMIN', 'FINANCEIRO', 'ADMIN_SISTEMA']) {
        expect(politica.validar(dez, { role })).toMatch(/pelo menos 12/);
      }
      // O Comprador e o Vendedor não aprovam pagamentos: fica o mínimo geral.
      for (const role of ['COMPRADOR', 'FORNECEDOR']) {
        expect(politica.validar(dez, { role })).toBeNull();
      }
    });

    test('recusa as senhas mais usadas do mundo', () => {
      for (const s of ['12345678', 'password123', 'kixima2026', 'Kixima@123']) {
        expect(politica.validar(s)).not.toBeNull();
      }
    });

    test('recusa sequências e caracteres repetidos', () => {
      expect(politica.validar('abcdefghij')).toMatch(/sequência/);
      expect(politica.validar('aaaaaaaaaaaa')).toMatch(/sequência|repetido/);
      expect(politica.validar('1234567890')).not.toBeNull();
    });

    test('recusa a senha que contém o próprio email', () => {
      expect(politica.validar('joanasilva-2026', { email: 'joanasilva@empresa.co.ao' }))
        .toMatch(/email/);
    });
  });

  describe('aplicação nos endpoints', () => {
    let tokens;
    beforeAll(async () => { tokens = await loginAll(); });

    test('mudar para uma senha fraca é recusado (422), não aceite em silêncio', async () => {
      const res = await auth(tokens.comprador)
        .patch('/api/auth/password')
        .send({ currentPassword: PASSWORD, newPassword: '12345678' });
      expect(res.status).toBe(422);
      expect(JSON.stringify(res.body)).toMatch(/10 caracteres/);
    });

    test('o Admin do Sistema não pode criar contas sensíveis com senha curta', async () => {
      const res = await auth(tokens.adminSistema).post('/api/companies/users').send({
        name: 'Financeiro Teste', email: `fin-${Date.now()}@teste.ao`,
        password: 'Valvula-42', role: 'FINANCEIRO',
      });
      expect(res.status).toBe(422);
      expect(JSON.stringify(res.body)).toMatch(/12 caracteres/);
    });

    test('o cadastro de empresa exige senha de Company Admin', async () => {
      const res = await request(app)
        .post('/api/companies/register')
        .field('name', 'Empresa Politica, Lda')
        .field('taxId', `AO-POL-${Date.now()}`)
        .field('type', 'CLIENTE')
        .field('contactEmail', 'geral@politica.co.ao')
        .field('adminName', 'Admin Politica')
        .field('adminEmail', `admin-${Date.now()}@politica.co.ao`)
        .field('adminPassword', 'Valvula-42')
        .field('termsAccepted', 'true');
      expect(res.status).toBe(422);
      expect(JSON.stringify(res.body)).toMatch(/12 caracteres/);
    });

    // O ponto mais importante: a política NÃO tranca ninguém fora.
    test('quem já tem senha antiga continua a entrar', async () => {
      expect(politica.validar(PASSWORD)).not.toBeNull(); // a senha das contas de teste não cumpre
      const res = await request(app).post('/api/auth/login').send({ email: USERS.comprador, password: PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeTruthy();
    });
  });
});
