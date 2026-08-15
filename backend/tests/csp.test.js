// tests/csp.test.js
// A CSP tem de deixar passar as imagens do bucket.
//
// Esta avaria não dá erro do lado do servidor — é o browser que recusa, e nos
// registos não fica nada. Também não aparece em desenvolvimento, porque aí é o
// Vite que serve o frontend e não passa pelo helmet. Ou seja: sem este teste,
// só se descobre em produção, a olhar para um catálogo sem fotografias.
const { request, app } = require('./helpers');
const csp = require('../src/config/csp');

describe('CSP — de onde o browser pode carregar imagens', () => {
  const original = { ...process.env };
  afterEach(() => { process.env = { ...original }; });

  test('sem armazenamento externo, só a própria origem', () => {
    delete process.env.STORAGE_PUBLIC_URL;
    delete process.env.STORAGE_ENDPOINT;
    expect(csp.origensDeImagem()).toEqual([]);
  });

  test('o URL público do bucket entra na política', () => {
    jest.resetModules();
    process.env.STORAGE_PUBLIC_URL = 'https://abc.supabase.co/storage/v1/object/public/product-images';
    const recarregado = require('../src/config/csp');
    // Só a ORIGEM, não o caminho: o bucket inteiro é a unidade de confiança e
    // uma directiva com caminho é mais frágil sem ganhar nada.
    expect(recarregado.origemDe(process.env.STORAGE_PUBLIC_URL)).toBe('https://abc.supabase.co');
  });

  test('as directivas mantêm o que o helmet já protegia', () => {
    const base = require('helmet').contentSecurityPolicy.getDefaultDirectives();
    const d = csp.directivas(base);
    // Não se afrouxa nada ao acrescentar o bucket.
    expect(d['script-src']).toEqual(base['script-src']);
    expect(d['object-src']).toEqual(base['object-src']);
    expect(d['img-src']).toContain("'self'");
  });

  test('o cabeçalho sai mesmo nas respostas', async () => {
    const res = await request(app).get('/health');
    const politica = res.headers['content-security-policy'];
    expect(politica).toBeTruthy();
    expect(politica).toMatch(/script-src 'self'/);
    expect(politica).toMatch(/object-src 'none'/);
    // blob: é preciso para as pré-visualizações de ficheiro antes do upload.
    expect(politica).toMatch(/img-src[^;]*blob:/);
  });
});
