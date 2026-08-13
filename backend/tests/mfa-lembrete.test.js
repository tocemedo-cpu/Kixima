// tests/mfa-lembrete.test.js
// Contas com poder que ainda não têm 2FA.
//
// A página de Prontidão dizia "8 contas de perfil ADMIN_SISTEMA ou
// COMPANY_ADMIN". Um número não se persegue: para o levar a zero é preciso
// saber QUEM são, se ainda entram na plataforma, e ter forma de lhes pedir.
//
// A linha que não se atravessa: não se ativa a 2FA por outra pessoa. Um
// administrador que o fizesse ficaria com os dois fatores, e deixava de haver
// dois. O que se pode fazer é pedir — com o prazo à frente.
const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/database');
const config = require('../src/config/env');
const notificationService = require('../src/services/notificationService');
const lembretes = require('../src/services/mfaLembreteService');
const { loginAll, auth } = require('./helpers');

let enviados;
let emailOriginal;

beforeAll(() => { emailOriginal = { ...config.email }; });

beforeEach(() => {
  enviados = [];
  config.email.provider = 'brevo';
  config.email.apenasLog = false;
  config.email.missing = [];
  jest.spyOn(notificationService, 'enviarEmailDireto').mockImplementation(async (para, assunto, corpo) => {
    enviados.push({ para, assunto, corpo });
    return { provider: 'teste', para };
  });
});

afterEach(async () => {
  jest.restoreAllMocks();
  Object.assign(config.email, emailOriginal);
  await prisma.auditLog.deleteMany({ where: { action: 'MFA_LEMBRETE_ENVIADO' } });
});

describe('Saber quem são', () => {
  let tokens;
  beforeAll(async () => { tokens = await loginAll(); });

  test('a lista traz o nome, a empresa e o perfil — não só um número', async () => {
    const res = await auth(tokens.adminSistema).get('/api/admin/mfa-pendentes');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    const u = res.body[0];
    expect(u).toHaveProperty('nome');
    expect(u).toHaveProperty('email');
    expect(u).toHaveProperty('perfil');
    expect(u).toHaveProperty('ultimoLogin');
  });

  test('só aparecem perfis abrangidos, e só quem ainda não tem 2FA', async () => {
    const res = await auth(tokens.adminSistema).get('/api/admin/mfa-pendentes');
    for (const u of res.body) {
      expect(config.auth.mfaRequiredRoles).toContain(u.perfil);
    }
    const emails = res.body.map((u) => u.email);
    expect(emails).not.toContain('comprador@petroangola.co.ao'); // não é perfil abrangido
  });

  test('quem ativa a 2FA sai da lista', async () => {
    const antes = (await auth(tokens.adminSistema).get('/api/admin/mfa-pendentes')).body;
    const alvo = antes[0];

    await prisma.user.update({
      where: { id: alvo.id },
      data: { totpEnabledAt: new Date(), mfaMethod: 'EMAIL' },
    });
    const depois = (await auth(tokens.adminSistema).get('/api/admin/mfa-pendentes')).body;
    expect(depois.map((u) => u.id)).not.toContain(alvo.id);
    expect(depois.length).toBe(antes.length - 1);

    await prisma.user.update({ where: { id: alvo.id }, data: { totpEnabledAt: null, mfaMethod: null } });
  });

  test('a lista é só para o Admin do Sistema', async () => {
    expect((await auth(tokens.comprador).get('/api/admin/mfa-pendentes')).status).toBe(403);
    expect((await request(app).get('/api/admin/mfa-pendentes')).status).toBe(401);
  });
});

describe('Pedir que ativem', () => {
  let tokens;
  beforeAll(async () => { tokens = await loginAll(); });

  test('cada pessoa recebe um email', async () => {
    const pendentes = await lembretes.pendentes();
    const res = await auth(tokens.adminSistema).post('/api/admin/mfa-lembrete');

    expect(res.status).toBe(200);
    expect(res.body.enviados.length).toBe(pendentes.length);
    expect(enviados.length).toBe(pendentes.length);
    expect(enviados[0].assunto).toMatch(/verificação em dois passos/i);
  });

  // Um pedido sem data é um pedido que se adia — foi o que aconteceu.
  test('o email diz o prazo e o que acontece quando passar', async () => {
    const anterior = config.auth.mfaEnforceFrom;
    config.auth.mfaEnforceFrom = new Date('2026-09-15T00:00:00Z');
    try {
      await auth(tokens.adminSistema).post('/api/admin/mfa-lembrete');
      expect(enviados[0].corpo).toContain('2026-09-15');
      expect(enviados[0].corpo).toMatch(/só dá acesso ao ecrã de ativação/);
      expect(enviados[0].corpo).toMatch(/Configurações → Segurança/);
    } finally {
      config.auth.mfaEnforceFrom = anterior;
    }
  });

  test('não se insiste com a mesma pessoa no mesmo dia — isso ensina-a a ignorar', async () => {
    const primeira = await auth(tokens.adminSistema).post('/api/admin/mfa-lembrete');
    expect(primeira.body.enviados.length).toBeGreaterThan(0);

    enviados = [];
    const segunda = await auth(tokens.adminSistema).post('/api/admin/mfa-lembrete');
    expect(segunda.body.enviados).toHaveLength(0);
    expect(segunda.body.ignorados.length).toBe(primeira.body.enviados.length);
    expect(enviados).toHaveLength(0);
  });

  // Um endereço que não recebe não pode calar os restantes.
  test('uma falha num email não impede os outros', async () => {
    const pendentes = await lembretes.pendentes();
    if (pendentes.length < 2) return;                     // precisa de dois para o teste fazer sentido

    notificationService.enviarEmailDireto.mockRejectedValueOnce(new Error('Brevo API 400: invalid recipient'));
    const res = await auth(tokens.adminSistema).post('/api/admin/mfa-lembrete');

    expect(res.body.falhas).toHaveLength(1);
    expect(res.body.falhas[0].erro).toMatch(/invalid recipient/);
    expect(res.body.enviados.length).toBe(pendentes.length - 1);
  });

  test('sem email configurado, recusa em vez de fingir que avisou', async () => {
    config.email.provider = 'console';
    config.email.apenasLog = true;
    const res = await auth(tokens.adminSistema).post('/api/admin/mfa-lembrete');
    expect(res.status).toBe(400);
    expect(enviados).toHaveLength(0);
  });

  test('o envio fica no trilho de auditoria', async () => {
    await auth(tokens.adminSistema).post('/api/admin/mfa-lembrete');
    const registos = await prisma.auditLog.findMany({ where: { action: 'MFA_LEMBRETE_ENVIADO' } });
    expect(registos.length).toBeGreaterThan(0);
    expect(registos[0].entityType).toBe('User');
  });

  test('só o Admin do Sistema pode enviar', async () => {
    expect((await auth(tokens.comprador).post('/api/admin/mfa-lembrete')).status).toBe(403);
    expect((await request(app).post('/api/admin/mfa-lembrete')).status).toBe(401);
  });
});
