// tests/lancamento.test.js
// Modo de lançamento no servidor (src/middleware/frontend.js).
//
// O que se prova, com uma pasta dist temporária e uma app Express mínima (a API e as
// sondas registadas ANTES, como no app.js):
//   - LIGADO: qualquer pedido de página devolve launch.html — "/", "/index.html", /login,
//     /cadastro, dashboards, páginas administrativas, rotas desconhecidas, URLs com
//     maiúsculas, barras duplas ou codificação percentual — e nada do index.html da app;
//   - NÃO se toca na API (200/401/404 JSON), nas sondas, nem nos ficheiros (assets,
//     imagens, launch.json), e só GET/HEAD são afectados;
//   - DESLIGADO (ou sem ficheiro, ou valor inválido): exactamente o comportamento de antes;
//   - o interruptor é relido quando o ficheiro muda, sem reiniciar.
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const request = require('supertest');
const { montarFrontend, criarLancamento } = require('../src/middleware/frontend');

const APP_HTML = '<!doctype html><html><body><div id="root">KIXIMA APP</div></body></html>';
const LANC_HTML = '<!doctype html><html><body><main>ESTAMOS A CHEGAR — BREVEMENTE</main></body></html>';

let dist;
let n = 0;
function escreverLancamento(valor) {
  const f = path.join(dist, 'launch.json');
  fs.writeFileSync(f, typeof valor === 'string' ? valor : JSON.stringify(valor));
  // o mtime tem de mudar entre escritas seguidas (resolução do sistema de ficheiros)
  const t = new Date(Date.now() + (++n) * 2000); fs.utimesSync(f, t, t);
}
function apagarLancamento() { fs.rmSync(path.join(dist, 'launch.json'), { force: true }); }

function montar(opcoes) {
  const app = express();
  app.use(express.json());
  // Registado ANTES do frontend, como no app.js: API, sondas e um webhook interno.
  app.get('/api/ping', (req, res) => res.json({ pong: true }));
  app.post('/api/auth/login', (req, res) => res.status(401).json({ error: 'INVALID' }));
  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.get('/ready', (req, res) => res.json({ ready: true }));
  app.post('/webhooks/pagamento', (req, res) => res.json({ recebido: true }));
  montarFrontend(app, express, dist, opcoes);
  // Como o notFoundHandler do app.js: o que a app não serviu é 404 JSON.
  app.use((req, res) => res.status(404).json({ error: 'ROUTE_NOT_FOUND' }));
  return app;
}

beforeAll(() => {
  dist = fs.mkdtempSync(path.join(os.tmpdir(), 'kixima-dist-'));
  fs.mkdirSync(path.join(dist, 'assets'));
  fs.writeFileSync(path.join(dist, 'index.html'), APP_HTML);
  fs.writeFileSync(path.join(dist, 'launch.html'), LANC_HTML);
  fs.writeFileSync(path.join(dist, 'assets', 'index-abc123.js'), 'console.log("app")');
  fs.writeFileSync(path.join(dist, 'LOGO.txt'), 'KIXIMA');
});
afterAll(() => fs.rmSync(dist, { recursive: true, force: true }));
beforeEach(() => escreverLancamento({ enabled: true }));

const PAGINAS = [
  '/', '/index.html', '/login', '/cadastro', '/register', '/recuperar', '/recuperar/abc',
  '/comprador', '/comprador/catalogo', '/empresa/aprovacoes', '/fornecedor/faturas',
  '/financeiro/historico', '/sistema', '/sistema/auditoria', '/sistema/administradores', '/seguranca',
  '/planos', '/termos', '/noticias', '/em-breve', '/institucional', '/launch.html', '/nao-existe', '/a/b/c/d',
  '/LOGIN', '/Sistema/Auditoria', '//login', '/login/', '/%6cogin', '/login?next=/sistema', '/sistema;x=1',
  '/assets/velho-ficheiro-que-ja-nao-existe.js', '/foto-inexistente.png',
];

describe('modo de lançamento LIGADO', () => {
  test.each(PAGINAS)('GET %s devolve só a página de lançamento', async (p) => {
    const r = await request(montar()).get(p);
    expect(r.status).toBe(200);
    expect(r.text).toContain('ESTAMOS A CHEGAR');
    expect(r.text).not.toContain('KIXIMA APP');
    expect(r.headers['content-type']).toMatch(/text\/html/);
    expect(r.headers['cache-control']).toBe('no-store');
  });

  test('HEAD também; e o corpo da app nunca sai', async () => {
    const app = montar();
    for (const p of ['/', '/login', '/sistema/auditoria']) {
      const r = await request(app).head(p);
      expect(r.status).toBe(200);
      expect(r.headers['content-type']).toMatch(/text\/html/);
    }
  });

  test('a API não é bloqueada: nem GET, nem POST, nem o 404 JSON de rotas /api desconhecidas', async () => {
    const app = montar();
    expect((await request(app).get('/api/ping')).body).toEqual({ pong: true });
    expect((await request(app).post('/api/auth/login').send({})).status).toBe(401);
    const r = await request(app).get('/api/nao-existe');
    expect(r.status).toBe(404);
    expect(r.body).toEqual({ error: 'ROUTE_NOT_FOUND' });
    expect((await request(app).get('/API/ping')).body).toEqual({ pong: true }); // o Express ignora maiúsculas
  });

  test('sondas e serviços internos (registados antes) não são tocados', async () => {
    const app = montar();
    expect((await request(app).get('/health')).body).toEqual({ status: 'ok' });
    expect((await request(app).get('/ready')).body).toEqual({ ready: true });
    expect((await request(app).post('/webhooks/pagamento').send({})).body).toEqual({ recebido: true });
  });

  test('ficheiros estáticos continuam a ser servidos (assets, launch.json, imagens)', async () => {
    const app = montar();
    expect((await request(app).get('/assets/index-abc123.js')).text).toContain('console.log("app")');
    expect((await request(app).get('/LOGO.txt')).text).toBe('KIXIMA');
    const j = await request(app).get('/launch.json');
    expect(j.status).toBe(200);
    expect(JSON.parse(j.text)).toEqual({ enabled: true });
  });

  test('outros métodos não são afectados (POST numa página não vira a página de lançamento)', async () => {
    const r = await request(montar()).post('/login').send({});
    expect(r.status).toBe(404);
    expect(r.body).toEqual({ error: 'ROUTE_NOT_FOUND' });
  });
});

describe('modo de lançamento DESLIGADO — tudo como antes', () => {
  test.each([
    ['enabled false', { enabled: false }],
    ['campo em falta', {}],
    ['"true" em texto', { enabled: 'true' }],
    ['1', { enabled: 1 }],
    ['JSON inválido', '{ nao e json'],
  ])('%s', async (_n, valor) => {
    escreverLancamento(valor);
    const app = montar();
    for (const p of ['/', '/index.html', '/login', '/sistema/auditoria', '/nao-existe']) {
      const r = await request(app).get(p);
      expect(r.status).toBe(200);
      expect(r.text).toContain('KIXIMA APP');
      expect(r.text).not.toContain('ESTAMOS A CHEGAR');
    }
    expect((await request(app).get('/api/ping')).body).toEqual({ pong: true });
  });

  test('sem launch.json', async () => {
    apagarLancamento();
    const r = await request(montar()).get('/login');
    expect(r.text).toContain('KIXIMA APP');
  });
});

describe('interruptor em tempo de execução e falhas', () => {
  test('relê o ficheiro quando muda, sem reiniciar', async () => {
    const app = montar();
    expect((await request(app).get('/')).text).toContain('ESTAMOS A CHEGAR');
    escreverLancamento({ enabled: false });
    expect((await request(app).get('/')).text).toContain('KIXIMA APP');
    escreverLancamento({ enabled: true });
    expect((await request(app).get('/login')).text).toContain('ESTAMOS A CHEGAR');
  });

  test('ligado mas sem launch.html: avisa uma vez e serve a app (a guarda do SPA assume)', async () => {
    const aviso = jest.fn();
    const bak = path.join(dist, 'launch.html.bak');
    fs.renameSync(path.join(dist, 'launch.html'), bak);
    try {
      const app = montar({ aviso });
      expect((await request(app).get('/login')).text).toContain('KIXIMA APP');
      expect((await request(app).get('/')).text).toContain('KIXIMA APP');
      expect(aviso).toHaveBeenCalledTimes(1);
    } finally {
      fs.renameSync(bak, path.join(dist, 'launch.html'));
    }
  });

  test('criarLancamento().ligado() reflecte o ficheiro', () => {
    const l = criarLancamento(dist);
    expect(l.ligado()).toBe(true);
    escreverLancamento({ enabled: false });
    expect(l.ligado()).toBe(false);
    apagarLancamento();
    expect(l.ligado()).toBe(false);
  });
});
