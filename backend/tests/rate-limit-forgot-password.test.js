// tests/rate-limit-forgot-password.test.js
// POST /api/auth/forgot-password devolve SEMPRE 200, exista ou não a conta
// (anti-enumeração — ver authController.forgotPassword). O authLimiter
// (usado pelo login) tem skipSuccessfulRequests:true, correto ali (um erro
// de dedo não deve gastar orçamento) — mas partilhado com forgot-password
// fazia com que NENHUM pedido a essa rota contasse alguma vez para o limite,
// porque nunca há um "pedido falhado" do ponto de vista HTTP: um atacante
// sem sessão conseguia disparar pedidos sem travão nenhum contra o mesmo
// email, inundando a caixa de correio de uma vítima.
//
// rateLimit.js desliga todos os limitadores em NODE_ENV=test — por isso este
// teste verifica a CONFIGURAÇÃO real (as opções passadas a
// express-rate-limit), exposta só para teste em `_options`, em vez de tentar
// simular produção e martelar a rota 429 vezes.
const { _options } = require('../src/middleware/rateLimit');

describe('forgotPasswordLimiter — configuração', () => {
  test('não herda skipSuccessfulRequests:true do authLimiter', () => {
    expect(_options.auth.skipSuccessfulRequests).toBe(true); // continua certo para o login
    expect(_options.forgotPassword.skipSuccessfulRequests).not.toBe(true);
  });

  test('é um limitador PRÓPRIO, não o mesmo objeto que o authLimiter', () => {
    expect(_options.forgotPassword).not.toBe(_options.auth);
  });
});
