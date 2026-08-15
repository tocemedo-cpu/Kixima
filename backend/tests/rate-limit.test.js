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
