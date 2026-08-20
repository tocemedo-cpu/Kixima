// tests/cors.test.js
// A allow-list de CORS é partilhada entre o Express (app.js) e o Socket.IO
// (realtimeService.js) — este teste cobre a lógica em si, isolada dos dois
// consumidores, para nunca mais divergirem sem que um teste avise.
describe('config/cors — origens aceites', () => {
  const original = { ...process.env };
  afterEach(() => { process.env = { ...original }; jest.resetModules(); });

  test('inclui sempre as origens fixas do Capacitor (Android/iOS)', () => {
    const corsConfig = require('../src/config/cors');
    expect(corsConfig.allowList()).toEqual(expect.arrayContaining(['https://localhost', 'capacitor://localhost']));
  });

  test('inclui o APP_URL configurado', () => {
    const corsConfig = require('../src/config/cors');
    const config = require('../src/config/env');
    expect(corsConfig.allowList()).toContain(config.appUrl);
  });

  test('CORS_ORIGINS extra entra na lista', () => {
    jest.resetModules();
    process.env.CORS_ORIGINS = 'https://parceiro.example.com, https://outro.example.com';
    const corsConfig = require('../src/config/cors');
    expect(corsConfig.allowList()).toEqual(expect.arrayContaining(['https://parceiro.example.com', 'https://outro.example.com']));
  });

  test('sem Origin (curl, same-origin), o pedido é sempre aceite', () => {
    const corsConfig = require('../src/config/cors');
    const cb = jest.fn();
    corsConfig.origin(undefined, cb);
    expect(cb).toHaveBeenCalledWith(null, true);
  });

  test('em teste/desenvolvimento, qualquer origem é aceite (NODE_ENV=test já está ativo na suite)', () => {
    const corsConfig = require('../src/config/cors');
    const cb = jest.fn();
    corsConfig.origin('https://qualquer-coisa.example.com', cb);
    expect(cb).toHaveBeenCalledWith(null, true);
  });
});
