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

// ---------------------------------------------------------------------------------------------
// ACESSO DA EQUIPA — a chave secreta (LAUNCH_BYPASS_KEY) e o cookie que deixam a equipa ver a app
// com o modo de lançamento ligado, sem abrir nada ao público.
// ---------------------------------------------------------------------------------------------
describe('acesso da equipa', () => {
  const CHAVE = 'chave-secreta-da-equipa-123456';
  const cookieDe = (r) => (r.headers['set-cookie'] || []).find((c) => c.startsWith('kixima_equipa='));
  const valorDo = (c) => c.split(';')[0];

  async function entrar(app, caminho = '/login') {
    const r = await request(app).get(`${caminho}?acesso=${CHAVE}`);
    return { r, cookie: valorDo(cookieDe(r)) };
  }

  test('chave certa: grava o cookie (httpOnly, lax, 30 dias, HMAC e não a chave) e redirecciona sem o parâmetro', async () => {
    const r = await request(montar({ chaveEquipa: CHAVE })).get(`/login?acesso=${CHAVE}&next=%2Fsistema`);
    expect(r.status).toBe(302);
    expect(r.headers.location).toBe('/login?next=%2Fsistema');
    const c = cookieDe(r);
    expect(c).toMatch(/HttpOnly/i);
    expect(c).toMatch(/SameSite=Lax/i);
    expect(c).toMatch(/Path=\//);
    expect(c).toMatch(/Max-Age=2592000|Expires=/i);
    expect(c).not.toContain(CHAVE); // o cookie nunca leva a chave
    expect(r.headers['cache-control']).toBe('no-store');
  });

  test('com o cookie: a equipa vê a aplicação em qualquer página e o /launch.json diz "desligado"', async () => {
    const app = montar({ chaveEquipa: CHAVE });
    const { cookie } = await entrar(app);
    for (const p of ['/', '/index.html', '/login', '/cadastro', '/sistema/auditoria', '/comprador', '/nao-existe', '/assets/velho.js']) {
      const r = await request(app).get(p).set('Cookie', cookie);
      expect(r.status).toBe(200);
      expect(r.text).toContain('KIXIMA APP');
      expect(r.text).not.toContain('ESTAMOS A CHEGAR');
    }
    const j = await request(app).get('/launch.json').set('Cookie', cookie);
    expect(j.body).toEqual({ enabled: false });
    expect(j.headers['cache-control']).toBe('no-store');
  });

  test('o público (sem cookie) continua a ver só a página em breve, e o launch.json verdadeiro', async () => {
    const app = montar({ chaveEquipa: CHAVE });
    for (const p of ['/', '/login', '/sistema', '/nao-existe']) {
      expect((await request(app).get(p)).text).toContain('ESTAMOS A CHEGAR');
    }
    expect(JSON.parse((await request(app).get('/launch.json')).text)).toEqual({ enabled: true });
  });

  test('chave errada, em branco ou parcial: ignorada, sem cookie, sem pistas', async () => {
    const app = montar({ chaveEquipa: CHAVE });
    for (const errada of ['', 'x', CHAVE.slice(0, -1), `${CHAVE}x`, 'sair-2', encodeURIComponent(CHAVE.toUpperCase())]) {
      const r = await request(app).get(`/login?acesso=${errada}`);
      expect(r.status).toBe(200);
      expect(r.text).toContain('ESTAMOS A CHEGAR');
      expect(cookieDe(r)).toBeUndefined();
    }
  });

  test('cookie falsificado, de outra chave ou truncado não vale', async () => {
    const app = montar({ chaveEquipa: CHAVE });
    const { cookie } = await entrar(app);
    const outra = montar({ chaveEquipa: 'outra-chave-completamente-diferente' });
    for (const c of ['kixima_equipa=abc', 'kixima_equipa=', cookie.slice(0, -4), cookie.replace(/.$/, (d) => (d === '0' ? '1' : '0'))]) {
      expect((await request(app).get('/login').set('Cookie', c)).text).toContain('ESTAMOS A CHEGAR');
    }
    expect((await request(outra).get('/login').set('Cookie', cookie)).text).toContain('ESTAMOS A CHEGAR'); // mudar a chave revoga tudo
  });

  test('?acesso=sair apaga o cookie e volta a página em breve', async () => {
    const app = montar({ chaveEquipa: CHAVE });
    const { cookie } = await entrar(app);
    const r = await request(app).get('/sistema?acesso=sair').set('Cookie', cookie);
    expect(r.status).toBe(302);
    expect(r.headers.location).toBe('/sistema');
    expect(cookieDe(r)).toMatch(/kixima_equipa=;|Expires=Thu, 01 Jan 1970/i);
  });

  test('sem LAUNCH_BYPASS_KEY, ou com uma chave curta, o acesso da equipa está desligado (modo estrito)', async () => {
    for (const chave of [undefined, '', 'curta', 'quinze-chars-ab']) {
      const app = montar({ chaveEquipa: chave === undefined ? '' : chave });
      const r = await request(app).get(`/login?acesso=${chave || 'qualquer'}`);
      expect(r.status).toBe(200);
      expect(r.text).toContain('ESTAMOS A CHEGAR');
      expect(cookieDe(r)).toBeUndefined();
    }
  });

  test('a API e as sondas não dependem do cookie nem do parâmetro', async () => {
    const app = montar({ chaveEquipa: CHAVE });
    expect((await request(app).get(`/api/ping?acesso=${CHAVE}`)).body).toEqual({ pong: true });
    expect((await request(app).get(`/health?acesso=${CHAVE}`)).body).toEqual({ status: 'ok' });
    expect(cookieDe(await request(app).get(`/api/ping?acesso=${CHAVE}`))).toBeUndefined();
  });

  test('só GET/HEAD: um POST com ?acesso= não grava nada', async () => {
    const r = await request(montar({ chaveEquipa: CHAVE })).post(`/login?acesso=${CHAVE}`).send({});
    expect(cookieDe(r)).toBeUndefined();
    expect(r.status).toBe(404);
  });

  test('desligado o modo, o parâmetro é inofensivo e a app serve-se normalmente', async () => {
    escreverLancamento({ enabled: false });
    const r = await request(montar({ chaveEquipa: CHAVE })).get('/login');
    expect(r.text).toContain('KIXIMA APP');
  });
});
