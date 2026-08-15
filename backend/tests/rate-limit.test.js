// tests/rate-limit.test.js
// O limite apertado é para quem tenta ADIVINHAR credenciais — não para quem já
// tem sessão.
//
// Estava aplicado a '/api/auth' inteiro, o que apanhava o '/api/auth/me' que a
// interface chama em cada carregamento de página. Um /me a 401 (sessão
// expirada, alguém que recarrega) contava para o limite, e ao fim de vinte a
// pessoa deixava de conseguir sequer TENTAR entrar: o limitador de força bruta
// a trancar a porta a quem tem a chave.
const { request, app, prisma } = require('./helpers');

afterAll(async () => { await prisma.$disconnect(); });

describe('A que endpoints se aplica o limite apertado', () => {
  test('/api/auth/me sem sessão devolve 401, e não 429, por muitas vezes que se chame', async () => {
    let ultimo;
    for (let i = 0; i < 40; i += 1) {
      ultimo = await request(app).get('/api/auth/me');
    }
    expect(ultimo.status).toBe(401);
  });
});

describe('A quem se conta cada pedido', () => {
  const { porUtilizadorOuIp } = require('../src/middleware/rateLimit');
  const jwt = require('jsonwebtoken');
  const config = require('../src/config/env');
  const sessionCookie = require('../src/utils/sessionCookie');

  const assinar = (sub) => jwt.sign({ sub }, config.auth.jwtSecret, { algorithm: 'HS256' });

  test('sem sessão, conta ao endereço', () => {
    expect(porUtilizadorOuIp({ headers: {}, ip: '10.0.0.7' })).toMatch(/^ip:/);
  });

  test('com sessão, conta à PESSOA — para um escritório atrás de um NAT não partilhar o mesmo balde', () => {
    const req = { headers: {}, ip: '10.0.0.7', cookies: { [sessionCookie.NOME]: assinar('utilizador-1') } };
    expect(porUtilizadorOuIp(req)).toBe('u:utilizador-1');
  });

  test('duas pessoas no MESMO endereço têm baldes diferentes', () => {
    const base = { headers: {}, ip: '10.0.0.7' };
    const a = porUtilizadorOuIp({ ...base, cookies: { [sessionCookie.NOME]: assinar('ana') } });
    const b = porUtilizadorOuIp({ ...base, cookies: { [sessionCookie.NOME]: assinar('bruno') } });
    expect(a).not.toBe(b);
  });

  test('um token forjado não gasta o orçamento de outra pessoa', () => {
    // Assinado com outro segredo: a verificação recusa-o e volta ao endereço.
    const falso = jwt.sign({ sub: 'vitima' }, 'segredo-errado', { algorithm: 'HS256' });
    const req = { headers: { authorization: `Bearer ${falso}` }, ip: '10.0.0.9' };
    expect(porUtilizadorOuIp(req)).toMatch(/^ip:/);
  });
});
