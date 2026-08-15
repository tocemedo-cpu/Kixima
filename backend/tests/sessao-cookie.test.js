// tests/sessao-cookie.test.js
// A sessão viaja num cookie httpOnly.
//
// O que estes testes prendem é a propriedade que dá o ganho: o cookie tem de
// ser httpOnly (senão o JavaScript da página volta a poder lê-lo, e estamos
// onde estávamos) e tem de ser SameSite (senão um sítio terceiro consegue
// fazer o browser usá-lo por nós).
const { request, app, prisma } = require('./helpers');
const sessionCookie = require('../src/utils/sessionCookie');

const EMAIL = 'comprador@petroangola.co.ao';
const SENHA = 'Kixima@123';

async function entrar() {
  return request(app).post('/api/auth/login').send({ email: EMAIL, password: SENHA });
}
const cookiesDe = (res) => [].concat(res.headers['set-cookie'] || []);
const oNosso = (res) => cookiesDe(res).find((c) => c.startsWith(`${sessionCookie.NOME}=`));

afterAll(async () => { await prisma.$disconnect(); });

describe('O cookie da sessão', () => {
  test('é emitido no login', async () => {
    expect(oNosso(await entrar())).toBeTruthy();
  });

  test('é httpOnly — é este atributo que impede um XSS de o ler', async () => {
    expect(oNosso(await entrar())).toMatch(/HttpOnly/i);
  });

  test('é SameSite=Lax — bloqueia o POST vindo de outro sítio sem partir os links de email', async () => {
    expect(oNosso(await entrar())).toMatch(/SameSite=Lax/i);
  });

  test('autentica sozinho, sem cabeçalho Authorization', async () => {
    const login = await entrar();
    const res = await request(app).get('/api/auth/me').set('Cookie', oNosso(login).split(';')[0]);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(EMAIL);
  });

  test('o logout apaga-o', async () => {
    const login = await entrar();
    const cookie = oNosso(login).split(';')[0];
    const saida = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    expect(saida.status).toBe(200);
    const limpo = oNosso(saida);
    // O browser só apaga quando o valor vem vazio (ou com data no passado).
    expect(limpo).toMatch(new RegExp(`${sessionCookie.NOME}=;|${sessionCookie.NOME}=;\\s*Expires`, 'i'));
  });

  test('o cookie ganha ao cabeçalho — o browser manda mais do que o JavaScript da página', async () => {
    const login = await entrar();
    const cookie = oNosso(login).split(';')[0];
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookie)
      .set('Authorization', 'Bearer lixo-completamente-invalido');
    expect(res.status).toBe(200);
  });
});

describe('O cabeçalho Bearer', () => {
  test('continua a funcionar para clientes programáticos', async () => {
    const { body } = await entrar();
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${body.token}`);
    expect(res.status).toBe(200);
  });
});

describe('Sem sessão nenhuma', () => {
  test('recusa, e a mensagem já não manda "enviar um Bearer"', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    // A interface não usa Bearer — dizer-lhe para o enviar era instruções erradas.
    expect(res.body.error.message).not.toMatch(/Bearer/);
  });
});
