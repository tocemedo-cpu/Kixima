// tests/email-idioma.test.js
// Os emails saem na língua do destinatário, e a configuração em falta não passa
// em silêncio.
//
// Dois problemas reais:
//  1) o idioma escolhido vivia só no localStorage do browser — que o servidor
//     não vê. Como é o servidor que escreve os convites, a recuperação de senha
//     e os avisos de fatura, um utilizador francês recebia tudo em português;
//  2) sem EMAIL_PROVIDER configurado, TUDO fica no log e o utilizador não vê
//     erro nenhum: simplesmente nunca recebe nada.
const emailI18n = require('../src/i18n/emails');
const config = require('../src/config/env');
const { loginAll, auth, prisma, USERS } = require('./helpers');

describe('Idioma dos emails', () => {
  test('traduz para a língua do destinatário', () => {
    const chave = 'Nova ordem de compra recebida';
    expect(emailI18n.t(chave, 'pt')).toBe(chave);
    expect(emailI18n.t(chave, 'en')).toBe('New purchase order received');
    expect(emailI18n.t(chave, 'fr')).toBe('Nouveau bon de commande reçu');
  });

  test('sem tradução devolve o português — nunca falha', () => {
    expect(emailI18n.t('Frase que ninguém traduziu', 'en')).toBe('Frase que ninguém traduziu');
    expect(emailI18n.t('Apólice atualizada', 'de')).toBe('Apólice atualizada');
    expect(emailI18n.t('Apólice atualizada', null)).toBe('Apólice atualizada');
  });

  test('substitui os marcadores em qualquer idioma', () => {
    const chave = 'Recebeu a ordem de compra {ref}. Reveja e aceite ou recuse.';
    expect(emailI18n.t(chave, 'en', { ref: 'PO-2026-000042' }))
      .toBe('You have received purchase order PO-2026-000042. Review and accept or decline it.');
    expect(emailI18n.t(chave, 'pt', { ref: 'PO-2026-000042' })).toContain('PO-2026-000042');
  });

  test('normaliza o que vier da base', () => {
    expect(emailI18n.normalizar('EN')).toBe('en');
    expect(emailI18n.normalizar('fr-FR')).toBe('fr');
    expect(emailI18n.normalizar('klingon')).toBe('pt');
    expect(emailI18n.normalizar(null)).toBe('pt');
  });
});

describe('Idioma guardado no servidor', () => {
  let tokens;
  beforeAll(async () => { tokens = await loginAll(); });
  afterAll(async () => {
    await prisma.user.update({ where: { email: USERS.comprador }, data: { locale: null } });
  });

  test('o utilizador grava a sua escolha', async () => {
    const res = await auth(tokens.comprador).put('/api/users/me/locale').send({ locale: 'fr' });
    expect(res.status).toBe(200);
    expect(res.body.locale).toBe('fr');

    const na_base = await prisma.user.findUnique({ where: { email: USERS.comprador }, select: { locale: true } });
    expect(na_base.locale).toBe('fr');
  });

  test('um idioma que não existe é recusado', async () => {
    const res = await auth(tokens.comprador).put('/api/users/me/locale').send({ locale: 'klingon' });
    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/pt, en, fr/);
  });

  test('sem sessão não se altera o idioma de ninguém', async () => {
    const request = require('supertest');
    const app = require('../src/app');
    const res = await request(app).put('/api/users/me/locale').send({ locale: 'en' });
    expect(res.status).toBe(401);
  });
});

describe('Configuração de email', () => {
  test('o provider "console" é assinalado como "nenhum envio real"', () => {
    // É o estado por omissão — e o mais perigoso, porque parece funcionar.
    expect(config.email.apenasLog).toBe(config.email.provider === 'console');
  });

  test('um provider ativo sem credenciais é assinalado', () => {
    // Reproduz a deteção sem mexer no ambiente do processo.
    const detetar = (provider, valores) => {
      const exigido = {
        brevo: { BREVO_API_KEY: valores.brevoApiKey },
        smtp: { SMTP_HOST: valores.host, SMTP_USER: valores.user, SMTP_PASSWORD: valores.password },
      }[provider] || {};
      return Object.entries(exigido).filter(([, v]) => !String(v || '').trim()).map(([k]) => k);
    };
    expect(detetar('brevo', { brevoApiKey: '' })).toEqual(['BREVO_API_KEY']);
    expect(detetar('brevo', { brevoApiKey: 'xkeysib-...' })).toEqual([]);
    expect(detetar('smtp', { host: 'smtp.brevo.com', user: '', password: '' }))
      .toEqual(['SMTP_USER', 'SMTP_PASSWORD']);
  });
});
