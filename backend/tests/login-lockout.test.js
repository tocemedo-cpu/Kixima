// tests/login-lockout.test.js
// Bloqueio de conta por tentativas falhadas.
//
// O limite por IP não protege uma CONTA: quem rode endereços tenta senhas sem
// tecto contra um email conhecido. Estes testes prendem o comportamento que
// fecha essa porta — e, tão importante, prendem as duas escolhas que impedem
// que ela se transforme numa arma: o bloqueio expira sempre, e o contador
// esquece.
const { request, app, prisma } = require('./helpers');
const bloqueio = require('../src/services/loginAttemptService');

const EMAIL = 'comprador@petroangola.co.ao';
const SENHA = 'Kixima@123';

async function tentar(password = 'errada-de-propósito') {
  return request(app).post('/api/auth/login').send({ email: EMAIL, password });
}

async function estado() {
  return prisma.user.findUnique({
    where: { email: EMAIL },
    select: { falhasSeguidas: true, bloqueadoAte: true, ultimaFalhaEm: true, avisoBloqueioEm: true },
  });
}

async function reporConta() {
  await prisma.user.update({
    where: { email: EMAIL },
    data: { falhasSeguidas: 0, bloqueadoAte: null, ultimaFalhaEm: null, avisoBloqueioEm: null },
  });
}

beforeEach(reporConta);
afterAll(async () => { await reporConta(); await prisma.$disconnect(); });

describe('A escada de bloqueio', () => {
  test('abaixo do limiar não bloqueia — engano não é ataque', () => {
    for (let i = 1; i < bloqueio.LIMIAR; i += 1) {
      expect(bloqueio.minutosDeBloqueio(i)).toBe(0);
    }
    expect(bloqueio.minutosDeBloqueio(bloqueio.LIMIAR)).toBeGreaterThan(0);
  });

  test('cresce e depois estabiliza — nunca é permanente', () => {
    const muitas = bloqueio.minutosDeBloqueio(bloqueio.LIMIAR + 50);
    expect(muitas).toBe(bloqueio.ESCADA_MINUTOS[bloqueio.ESCADA_MINUTOS.length - 1]);
    expect(Number.isFinite(muitas)).toBe(true);
  });
});

describe('Login com senha errada', () => {
  test('conta as falhas', async () => {
    await tentar();
    await tentar();
    expect((await estado()).falhasSeguidas).toBe(2);
  });

  test('ao chegar ao limiar, a conta fica bloqueada', async () => {
    for (let i = 0; i < bloqueio.LIMIAR; i += 1) await tentar();
    const e = await estado();
    expect(e.falhasSeguidas).toBe(bloqueio.LIMIAR);
    expect(e.bloqueadoAte).toBeTruthy();
    expect(new Date(e.bloqueadoAte).getTime()).toBeGreaterThan(Date.now());
  });

  test('bloqueada, recusa mesmo a senha CERTA — e diz quanto falta', async () => {
    for (let i = 0; i < bloqueio.LIMIAR; i += 1) await tentar();
    const res = await request(app).post('/api/auth/login').send({ email: EMAIL, password: SENHA });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/bloqueada durante \d+ minuto/);
  });

  test('passado o tempo, volta a abrir', async () => {
    for (let i = 0; i < bloqueio.LIMIAR; i += 1) await tentar();
    // O relógio anda para a frente: o bloqueio expirou.
    await prisma.user.update({
      where: { email: EMAIL },
      data: { bloqueadoAte: new Date(Date.now() - 1000) },
    });
    const res = await request(app).post('/api/auth/login').send({ email: EMAIL, password: SENHA });
    expect(res.status).toBe(200);
  });

  test('o titular é avisado — é a única parte que apanha um ataque que acerta', async () => {
    for (let i = 0; i < bloqueio.LIMIAR; i += 1) await tentar();
    expect((await estado()).avisoBloqueioEm).toBeTruthy();
  });
});

describe('Entrar com sucesso', () => {
  test('apaga o rasto das falhas anteriores', async () => {
    await tentar();
    await tentar();
    const res = await request(app).post('/api/auth/login').send({ email: EMAIL, password: SENHA });
    expect(res.status).toBe(200);
    const e = await estado();
    expect(e.falhasSeguidas).toBe(0);
    expect(e.bloqueadoAte).toBeNull();
  });
});

describe('O contador esquece', () => {
  test('falhas antigas não somam às de hoje', async () => {
    // Quatro falhas há muito tempo — uma pessoa distraída ao longo de meses.
    await prisma.user.update({
      where: { email: EMAIL },
      data: {
        falhasSeguidas: bloqueio.LIMIAR - 1,
        ultimaFalhaEm: new Date(Date.now() - (bloqueio.JANELA_DE_ESQUECIMENTO_MIN + 5) * 60 * 1000),
      },
    });
    await tentar();
    const e = await estado();
    // Recomeça do 1, e não bloqueia: sem esquecimento, esta pessoa ficava
    // fechada de fora por enganos espalhados por semanas.
    expect(e.falhasSeguidas).toBe(1);
    expect(e.bloqueadoAte).toBeNull();
  });
});

describe('Email que não existe', () => {
  test('continua a devolver o mesmo que uma senha errada', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ninguem@exemplo.com', password: 'x' });
    expect(res.status).toBe(401);
  });
});
