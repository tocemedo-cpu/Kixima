// src/api/client.test.js
// A base da URL da API decide-se UMA VEZ, à carga do módulo (window.Capacitor
// já tem de estar definido nessa altura) — por isso cada cenário (Web vs.
// Capacitor nativo) importa o módulo de fresco, depois de preparar
// window.Capacitor, em vez de reconfigurar um módulo já carregado.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

async function carregarClienteComo({ nativo }) {
  vi.resetModules();
  if (nativo) {
    window.Capacitor = { isNativePlatform: () => true };
  } else {
    delete window.Capacitor;
  }
  return import('./client');
}

beforeEach(() => {
  localStorage.clear();
  delete window.Capacitor;
});

afterEach(() => {
  delete window.Capacitor;
  vi.unstubAllGlobals();
});

function mockFetchOk(body, { contentType = 'application/json' } = {}) {
  const headers = new Headers(contentType ? { 'content-type': contentType } : {});
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers,
    json: async () => body,
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('Web (sem Capacitor)', () => {
  test('pedidos usam a origem da própria página, sem Authorization', async () => {
    const { api } = await carregarClienteComo({ nativo: false });
    const fetchMock = mockFetchOk({ ok: true });
    await api.get('/api/auth/me');

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(`${window.location.origin}/api/auth/me`);
    expect(options.headers.Authorization).toBeUndefined();
    expect(options.credentials).toBe('include');
  });

  test('definirBearerNativo não tem efeito nenhum fora do Capacitor', async () => {
    const { api, definirBearerNativo } = await carregarClienteComo({ nativo: false });
    definirBearerNativo('um-token-qualquer');
    const fetchMock = mockFetchOk({ ok: true });
    await api.get('/api/auth/me');

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });
});

describe('Capacitor nativo (Android/iOS)', () => {
  test('pedidos vão para https://kixima.net, nunca para a origem da WebView', async () => {
    const { api } = await carregarClienteComo({ nativo: true });
    const fetchMock = mockFetchOk({ ok: true });
    await api.get('/api/auth/login');

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('https://kixima.net/api/auth/login');
  });

  test('não duplica /api (kixima.net/api/api/...)', async () => {
    const { api } = await carregarClienteComo({ nativo: true });
    const fetchMock = mockFetchOk({ ok: true });
    await api.get('/api/auth/me');

    expect(fetchMock.mock.calls[0][0]).not.toMatch(/\/api\/api\//);
  });

  test('depois do login, definirBearerNativo faz os pedidos seguintes levarem Authorization: Bearer', async () => {
    const { api, definirBearerNativo } = await carregarClienteComo({ nativo: true });
    definirBearerNativo('jwt-de-teste');
    const fetchMock = mockFetchOk({ user: { id: 'u1' } });
    await api.get('/api/auth/me');

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer jwt-de-teste');
    // credentials: 'include' continua presente — o cookie ainda é tentado.
    expect(fetchMock.mock.calls[0][1].credentials).toBe('include');
  });

  test('logout (definirBearerNativo(null)) deixa de enviar Authorization', async () => {
    const { api, definirBearerNativo } = await carregarClienteComo({ nativo: true });
    definirBearerNativo('jwt-de-teste');
    definirBearerNativo(null);
    const fetchMock = mockFetchOk({ ok: true });
    await api.get('/api/auth/me');

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });
});

describe('Robustez contra respostas vazias/não-JSON', () => {
  test('sucesso HTTP sem corpo JSON válido lança um erro claro, não devolve null', async () => {
    const { api } = await carregarClienteComo({ nativo: false });
    mockFetchOk(null, { contentType: 'text/html' });

    await expect(api.post('/api/auth/login', { email: 'a@b.co', password: 'x' }))
      .rejects.toThrow(/dados válidos/);
  });

  test('uma resposta JSON válida continua a devolver os dados normalmente', async () => {
    const { api } = await carregarClienteComo({ nativo: false });
    mockFetchOk({ requires2fa: false, user: { id: 'u1' }, token: 't' });

    const result = await api.post('/api/auth/login', { email: 'a@b.co', password: 'x' });
    expect(result.user.id).toBe('u1');
  });

  test('respostas de erro (não-ok) continuam a lançar com a mensagem do servidor', async () => {
    const { api } = await carregarClienteComo({ nativo: false });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ error: { message: 'Credenciais inválidas.', code: 'UNAUTHORIZED' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.post('/api/auth/login', { email: 'a@b.co', password: 'x' }))
      .rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
  });
});
