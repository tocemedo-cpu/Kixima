// tests/mfa-email.test.js
// Verificação em dois passos por EMAIL.
//
// O método existe porque a app de autenticação, apesar de mais segura, obriga a
// instalar e configurar uma aplicação — e na prática isso faz com que a 2FA não
// seja ativada de todo. Um segundo fator que ninguém usa protege zero contas.
//
// O que estes testes protegem, por ordem de importância:
//  1. NINGUÉM pode ficar trancado fora da conta. Ativar a 2FA por email num
//     servidor sem email configurado seria exatamente isso, e em silêncio;
//  2. o código é uma credencial: uso único, validade curta, tentativas
//     contadas, e guardado em hash;
//  3. quem já usava a app continua a entrar pela app.
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const prisma = require('../src/config/database');
const config = require('../src/config/env');
const notificationService = require('../src/services/notificationService');
const mfaEmail = require('../src/services/mfaEmailService');
const totpUtil = require('../src/utils/totp');
const { PASSWORD } = require('./helpers');

const EMAIL = 'comprador@petroangola.co.ao';
const auth = (token) => ({ Authorization: `Bearer ${token}` });

// Intercepta o envio e guarda o código, que é o que o utilizador receberia.
let enviados;
let emailOriginal;

beforeAll(() => { emailOriginal = { ...config.email }; });

beforeEach(() => {
  enviados = [];
  // Um servidor com email a funcionar — é o pressuposto de todo este método.
  config.email.provider = 'brevo';
  config.email.apenasLog = false;
  config.email.missing = [];
  jest.spyOn(notificationService, 'enviarEmailDireto').mockImplementation(async (para, assunto, corpo) => {
    enviados.push({ para, assunto, corpo, codigo: (corpo.match(/\b(\d{6})\b/) || [])[1] });
    return { provider: 'teste', para };
  });
});

afterEach(async () => {
  jest.restoreAllMocks();
  Object.assign(config.email, emailOriginal);
  await prisma.user.update({
    where: { email: EMAIL },
    data: { totpEnabledAt: null, totpSecret: null, mfaMethod: null, mfaCodeHash: null, mfaCodeExpiraEm: null, mfaCodeTentativas: 0, mfaCodeEnviadoEm: null },
  });
});

async function entrar() {
  const res = await request(app).post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });
  return res.body;
}

describe('Ativar a 2FA por email', () => {
  test('o código chega ao email da pessoa e ativa a verificação', async () => {
    const { token } = await entrar();

    const envio = await request(app).post('/api/auth/2fa/email/enviar').set(auth(token));
    expect(envio.status).toBe(200);
    expect(envio.body.enviadoPara).toMatch(/@petroangola\.co\.ao$/);
    expect(enviados).toHaveLength(1);
    expect(enviados[0].para).toBe(EMAIL);

    const ativar = await request(app).post('/api/auth/2fa/enable').set(auth(token))
      .send({ code: enviados[0].codigo });
    expect(ativar.status).toBe(200);
    expect(ativar.body).toMatchObject({ enabled: true, metodo: 'EMAIL' });
  });

  // O ponto mais importante do ficheiro.
  test('num servidor SEM email configurado, recusa-se a ativar', async () => {
    // Ativar aqui deixaria a pessoa sem forma nenhuma de voltar a entrar — e sem
    // erro nenhum a explicar porquê. Vale mais não ter 2FA do que trancar toda
    // a gente fora da plataforma.
    config.email.provider = 'console';
    config.email.apenasLog = true;

    const { token } = await entrar();
    const res = await request(app).post('/api/auth/2fa/email/enviar').set(auth(token));
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/inacessível|não está configurado/i);
    expect(enviados).toHaveLength(0);
  });

  // Um "Ocorreu um erro interno" aqui é inútil para as duas pessoas envolvidas:
  // quem está a ativar não sabe o que fazer, e quem administra não sabe o que
  // corrigir. O erro do fornecedor de email é o que diz ambas as coisas.
  test('se o envio falhar, diz o motivo em vez de "erro interno"', async () => {
    notificationService.enviarEmailDireto.mockRejectedValueOnce(
      new Error('Brevo API 401: Key not found'),
    );
    const { token } = await entrar();
    const res = await request(app).post('/api/auth/2fa/email/enviar').set(auth(token));

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/Key not found/);
    expect(res.body.error.message).toMatch(/não ative a verificação por email/i);

    // E não fica um código pendente que ninguém recebeu.
    const na_base = await prisma.user.findUnique({ where: { email: EMAIL }, select: { mfaCodeHash: true } });
    expect(na_base.mfaCodeHash).toBeNull();
  });

  test('o estado avisa a interface antes de deixar tentar', async () => {
    config.email.provider = 'console';
    config.email.apenasLog = true;
    const { token } = await entrar();
    const res = await request(app).get('/api/auth/2fa/status').set(auth(token));
    expect(res.body.emailIndisponivel).toMatch(/não está configurado/i);
  });

  test('o email mostrado vem mascarado', () => {
    expect(mfaEmail.mascarar('comprador@petroangola.co.ao')).toBe('c****r@petroangola.co.ao');
    expect(mfaEmail.mascarar('ab@x.ao')).toBe('a@x.ao');
  });

  test('o código NÃO fica em texto na base de dados', async () => {
    const { token } = await entrar();
    await request(app).post('/api/auth/2fa/email/enviar').set(auth(token));
    const na_base = await prisma.user.findUnique({ where: { email: EMAIL }, select: { mfaCodeHash: true } });
    expect(na_base.mfaCodeHash).not.toContain(enviados[0].codigo);
    expect(await bcrypt.compare(enviados[0].codigo, na_base.mfaCodeHash)).toBe(true);
  });
});

describe('O código é uma credencial, e trata-se como tal', () => {
  async function comCodigo() {
    const { token } = await entrar();
    await request(app).post('/api/auth/2fa/email/enviar').set(auth(token));
    return { token, codigo: enviados[0].codigo };
  }

  test('é de uso único — não serve duas vezes', async () => {
    const { token, codigo } = await comCodigo();
    expect((await request(app).post('/api/auth/2fa/enable').set(auth(token)).send({ code: codigo })).status).toBe(200);

    // Desativa e tenta reutilizar o mesmo código.
    await prisma.user.update({ where: { email: EMAIL }, data: { totpEnabledAt: null, mfaMethod: null } });
    const outra = await request(app).post('/api/auth/2fa/enable').set(auth(token)).send({ code: codigo });
    expect(outra.status).toBeGreaterThanOrEqual(400);
  });

  test('expira — não fica válido para sempre', async () => {
    const { token, codigo } = await comCodigo();
    await prisma.user.update({
      where: { email: EMAIL },
      data: { mfaCodeExpiraEm: new Date(Date.now() - 1000) },
    });
    const res = await request(app).post('/api/auth/2fa/enable').set(auth(token)).send({ code: codigo });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/expirou/i);
  });

  test('ao fim de poucas tentativas o código morre — 10 minutos não podem dar para tentar tudo', async () => {
    const { token } = await comCodigo();
    let ultima;
    for (let i = 0; i < mfaEmail.TENTATIVAS_MAX; i++) {
      ultima = await request(app).post('/api/auth/2fa/enable').set(auth(token)).send({ code: '000000' });
    }
    expect(ultima.body.error.message).toMatch(/esgotadas/i);

    const na_base = await prisma.user.findUnique({ where: { email: EMAIL }, select: { mfaCodeHash: true } });
    expect(na_base.mfaCodeHash).toBeNull();
  });

  test('o reenvio é travado — não se usa a plataforma para inundar uma caixa de correio', async () => {
    const { token } = await comCodigo();
    const res = await request(app).post('/api/auth/2fa/email/enviar').set(auth(token));
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/Aguarde \d+ segundos/);
    expect(enviados).toHaveLength(1);
  });

  test('cada código é diferente do anterior', async () => {
    const { token } = await entrar();
    const vistos = new Set();
    for (let i = 0; i < 5; i++) {
      await prisma.user.update({ where: { email: EMAIL }, data: { mfaCodeEnviadoEm: null } });
      await request(app).post('/api/auth/2fa/email/enviar').set(auth(token));
      vistos.add(enviados[enviados.length - 1].codigo);
    }
    expect(vistos.size).toBe(5);
  });
});

describe('Entrar com a 2FA por email', () => {
  async function ativar() {
    const { token } = await entrar();
    await request(app).post('/api/auth/2fa/email/enviar').set(auth(token));
    await request(app).post('/api/auth/2fa/enable').set(auth(token)).send({ code: enviados[0].codigo });
    enviados = [];
  }

  test('a senha deixa de bastar, e o código chega ao email', async () => {
    await ativar();
    const login = await entrar();
    expect(login.requires2fa).toBe(true);
    expect(login.metodo).toBe('EMAIL');
    expect(login.token).toBeUndefined();
    expect(enviados).toHaveLength(1);

    const res = await request(app).post('/api/auth/2fa/verify')
      .send({ challenge: login.challenge, code: enviados[0].codigo });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  // Esta regressão já aconteceu: o travão de reenvio (60s) era aplicado também
  // ao envio automático do login. Quem acabasse de ativar a 2FA e voltasse a
  // entrar no minuto seguinte via o LOGIN falhar com "aguarde 47 segundos", sem
  // forma nenhuma de entrar. O travão existe para conter pedidos repetidos de
  // propósito — nunca para barrar quem se está a autenticar.
  test('entrar logo a seguir a ativar NÃO é travado', async () => {
    await ativar();
    const login = await entrar();
    expect(login.requires2fa).toBe(true);
    expect(login.challenge).toBeTruthy();
  });

  test('entrar duas vezes seguidas reaproveita o código, sem enviar outro', async () => {
    await ativar();
    const primeiro = await entrar();
    expect(enviados).toHaveLength(1);

    const segundo = await entrar();
    expect(segundo.requires2fa).toBe(true);
    expect(enviados).toHaveLength(1);          // não se mandou um segundo email
    expect(segundo.reaproveitado).toBe(true);

    // E o código que a pessoa já tem na caixa continua a servir.
    const res = await request(app).post('/api/auth/2fa/verify')
      .send({ challenge: segundo.challenge, code: enviados[0].codigo });
    expect(res.status).toBe(200);
  });

  test('um código errado não entra', async () => {
    await ativar();
    const login = await entrar();
    const res = await request(app).post('/api/auth/2fa/verify')
      .send({ challenge: login.challenge, code: '000000' });
    expect(res.status).toBe(401);
  });

  test('dá para pedir outro código sem recomeçar o login', async () => {
    await ativar();
    const login = await entrar();
    await prisma.user.update({ where: { email: EMAIL }, data: { mfaCodeEnviadoEm: null } });

    const re = await request(app).post('/api/auth/2fa/reenviar').send({ challenge: login.challenge });
    expect(re.status).toBe(200);
    expect(enviados).toHaveLength(2);

    // O código antigo deixou de servir; só o novo entra.
    const antigo = await request(app).post('/api/auth/2fa/verify')
      .send({ challenge: login.challenge, code: enviados[0].codigo });
    expect(antigo.status).toBe(401);
    const novo = await request(app).post('/api/auth/2fa/verify')
      .send({ challenge: login.challenge, code: enviados[1].codigo });
    expect(novo.status).toBe(200);
  });

  test('sem um desafio válido não se pede código nenhum', async () => {
    const res = await request(app).post('/api/auth/2fa/reenviar').send({ challenge: 'x'.repeat(40) });
    expect(res.status).toBe(401);
    expect(enviados).toHaveLength(0);
  });
});

// Quem já configurou a app não pode ser afetado por esta mudança.
describe('Quem usa a app de autenticação continua igual', () => {
  test('o login pede o código da app, não do email', async () => {
    const { token } = await entrar();
    const setup = await request(app).post('/api/auth/2fa/setup').set(auth(token));
    await request(app).post('/api/auth/2fa/enable').set(auth(token))
      .send({ code: totpUtil.totp(setup.body.secret) });

    const login = await entrar();
    expect(login.metodo).toBe('TOTP');
    expect(enviados).toHaveLength(0);   // nada foi enviado por email

    const res = await request(app).post('/api/auth/2fa/verify')
      .send({ challenge: login.challenge, code: totpUtil.totp(setup.body.secret) });
    expect(res.status).toBe(200);
  });

  test('e não lhe é oferecido reenvio por email', async () => {
    const { token } = await entrar();
    const setup = await request(app).post('/api/auth/2fa/setup').set(auth(token));
    await request(app).post('/api/auth/2fa/enable').set(auth(token))
      .send({ code: totpUtil.totp(setup.body.secret) });

    const login = await entrar();
    const re = await request(app).post('/api/auth/2fa/reenviar').send({ challenge: login.challenge });
    expect(re.status).toBeGreaterThanOrEqual(400);
    expect(re.body.error.message).toMatch(/app de autenticação/i);
  });
});
