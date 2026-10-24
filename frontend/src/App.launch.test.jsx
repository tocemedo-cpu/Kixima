// src/App.launch.test.jsx
// MODO DE LANÇAMENTO no SPA — a guarda global em App.
//   - enabled true: QUALQUER endereço mostra só a página de lançamento (login, cadastro,
//     dashboards, administração, rotas desconhecidas, /em-breve) — também com sessão — e nenhuma
//     rota da app chega a ser montada;
//   - enabled false, ficheiro em falta ou ilegível: a app funciona como sempre;
//   - enquanto o ficheiro é lido não se mostra nada; a API nunca é pedida por causa disto.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

let sessao = { user: null, loading: false };
vi.mock('./auth/AuthContext', () => ({ useAuth: () => sessao }));
// A home corporativa e o resto da app são pesados e irrelevantes aqui: o teste só quer
// saber QUAL das páginas é escolhida, e que as rotas da app nem sequer são montadas.
vi.mock('./pages/corporate/CorporateHome', () => ({ default: () => <div>HOME-CORPORATIVA</div> }));
vi.mock('./pages/shared/LoginPage', () => ({ default: () => <div>LOGIN</div> }));
vi.mock('./pages/shared/Register', () => ({ default: () => <div>CADASTRO</div> }));
vi.mock('./components/AppLayout', () => ({ default: () => <div>SHELL-DA-APP</div> }));
vi.mock('./realtime/RealtimeContext', () => ({ RealtimeProvider: ({ children }) => children }));

// eslint-disable-next-line import/first
import App from './App';

function lancamento(corpo, { ok = true, status = 200 } = {}) {
  global.fetch = vi.fn(async (url) => {
    if (String(url).includes('launch.json')) return { ok, status, json: async () => corpo };
    return { ok: false, status: 404, json: async () => ({}) };
  });
}
const abrir = (caminho) => render(<MemoryRouter initialEntries={[caminho]}><App /></MemoryRouter>);

beforeEach(() => { sessao = { user: null, loading: false }; });
afterEach(() => { vi.restoreAllMocks(); delete global.fetch; });

const TODOS_OS_ENDERECOS = [
  '/', '/login', '/cadastro', '/register', '/recuperar', '/recuperar/abc', '/convite/xyz', '/planos', '/termos', '/noticias', '/faq',
  '/comprador', '/comprador/catalogo', '/comprador/checkout', '/empresa', '/empresa/aprovacoes', '/fornecedor', '/fornecedor/faturas',
  '/financeiro', '/financeiro/historico', '/sistema', '/sistema/auditoria', '/sistema/administradores', '/seguranca',
  '/em-breve', '/institucional', '/nao-existe', '/a/b/c',
];

describe('modo de lançamento LIGADO', () => {
  test.each(TODOS_OS_ENDERECOS)('%s mostra só a página de lançamento', async (caminho) => {
    lancamento({ enabled: true });
    abrir(caminho);
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Estamos a chegar… Brevemente!');
    for (const t of ['HOME-CORPORATIVA', 'LOGIN', 'CADASTRO', 'SHELL-DA-APP']) expect(screen.queryByText(t)).not.toBeInTheDocument();
  });

  test.each(['COMPRADOR', 'COMPANY_ADMIN', 'FORNECEDOR', 'FINANCEIRO', 'ADMIN_SISTEMA'])('com sessão (%s) também: nenhum dashboard', async (role) => {
    lancamento({ enabled: true });
    sessao = { user: { id: 'u1', role }, loading: false };
    abrir('/');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Estamos a chegar');
    expect(screen.queryByText('SHELL-DA-APP')).not.toBeInTheDocument();
  });

  test('só pede o launch.json (nenhuma chamada à API)', async () => {
    lancamento({ enabled: true });
    abrir('/login');
    await screen.findByRole('heading', { level: 1 });
    const urls = global.fetch.mock.calls.map((c) => String(c[0]));
    expect(urls.every((u) => u.includes('launch.json'))).toBe(true);
  });
});

describe('modo de lançamento DESLIGADO — tudo normal', () => {
  test.each([
    ['enabled false', { enabled: false }, 200],
    ['campo em falta', {}, 200],
    ['"true" em texto', { enabled: 'true' }, 200],
    ['ficheiro em falta (404)', null, 404],
  ])('%s', async (_n, corpo, status) => {
    lancamento(corpo, { ok: status === 200, status });
    abrir('/login');
    expect(await screen.findByText('LOGIN')).toBeInTheDocument();
    expect(screen.queryByText('Brevemente!')).not.toBeInTheDocument();
  });

  test('a raiz é a home corporativa e o login funciona', async () => {
    lancamento({ enabled: false });
    const { unmount } = abrir('/');
    expect(await screen.findByText('HOME-CORPORATIVA')).toBeInTheDocument();
    unmount();
    abrir('/cadastro');
    expect(await screen.findByText('CADASTRO')).toBeInTheDocument();
  });

  test('com sessão a raiz leva ao dashboard do papel', async () => {
    lancamento({ enabled: false });
    sessao = { user: { id: 'u1', role: 'COMPRADOR' }, loading: false };
    abrir('/');
    expect(await screen.findByText('SHELL-DA-APP')).toBeInTheDocument();
    expect(screen.queryByText('Brevemente!')).not.toBeInTheDocument();
  });

  test('/em-breve existe para rever a página', async () => {
    lancamento({ enabled: false });
    abrir('/em-breve');
    expect(await screen.findByText('Brevemente!')).toBeInTheDocument();
  });

  test('erro de rede na primeira leitura: site de sempre (não bloqueia por engano)', async () => {
    global.fetch = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    abrir('/login');
    expect(await screen.findByText('LOGIN')).toBeInTheDocument();
  });
});

describe('ao ler o ficheiro', () => {
  test('enquanto o launch.json não responde não se mostra nada (nem a app, nem a página)', async () => {
    let resolver;
    global.fetch = vi.fn(() => new Promise((r) => { resolver = r; }));
    const { container } = abrir('/login');
    expect(container).toBeEmptyDOMElement();
    await act(async () => { resolver({ ok: true, status: 200, json: async () => ({ enabled: true }) }); });
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument());
  });

  test('um separador aberto passa a respeitar o interruptor quando a janela volta a ter foco', async () => {
    lancamento({ enabled: false });
    abrir('/login');
    expect(await screen.findByText('LOGIN')).toBeInTheDocument();
    lancamento({ enabled: true });
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Estamos a chegar');
    // e uma falha passageira de rede NÃO abre a app por engano
    global.fetch = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.queryByText('LOGIN')).not.toBeInTheDocument();
  });
});
