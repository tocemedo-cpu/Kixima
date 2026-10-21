// src/App.launch.test.jsx
// Página de lançamento na raiz "/" — o que NÃO pode mudar e o que muda.
//   - interruptor ligado, sem sessão: "/" mostra a página de lançamento;
//   - interruptor desligado ou ficheiro com problemas: "/" mostra a home de sempre;
//   - com sessão: "/" continua a ir para o dashboard do papel, e nem lê o interruptor;
//   - /em-breve e /institucional existem sempre, qualquer que seja o interruptor.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

let sessao = { user: null, loading: false };
vi.mock('./auth/AuthContext', () => ({ useAuth: () => sessao }));
// A home corporativa e o resto da app são pesados e irrelevantes aqui: o teste
// só quer saber QUAL das duas páginas é escolhida.
vi.mock('./pages/corporate/CorporateHome', () => ({ default: () => <div>HOME-CORPORATIVA</div> }));
vi.mock('./pages/shared/LoginPage', () => ({ default: () => <div>LOGIN</div> }));

// eslint-disable-next-line import/first
import App, { Landing } from './App';
// eslint-disable-next-line import/first
import ComingSoon from './pages/corporate/ComingSoon';

function lancamento(corpo, { ok = true } = {}) {
  global.fetch = vi.fn(async (url) => {
    if (String(url).includes('launch.json')) return { ok, json: async () => corpo };
    return { ok: false, status: 404, json: async () => ({}) };
  });
}

beforeEach(() => { sessao = { user: null, loading: false }; });
afterEach(() => { vi.restoreAllMocks(); delete global.fetch; });

describe('raiz "/"', () => {
  test('interruptor ligado, sem sessão: página de lançamento', async () => {
    lancamento({ enabled: true });
    render(<MemoryRouter initialEntries={['/']}><Routes><Route path="/" element={<Landing />} /></Routes></MemoryRouter>);
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Estamos a chegar…');
    expect(screen.getByText('Brevemente!')).toBeInTheDocument();
    expect(screen.queryByText('HOME-CORPORATIVA')).not.toBeInTheDocument();
  });

  test.each([
    ['desligado', { enabled: false }, true],
    ['ficheiro sem o campo', {}, true],
    ['ficheiro em falta (404)', null, false],
  ])('interruptor %s: home corporativa de sempre', async (_n, corpo, ok) => {
    lancamento(corpo, { ok });
    render(<MemoryRouter initialEntries={['/']}><Routes><Route path="/" element={<Landing />} /></Routes></MemoryRouter>);
    expect(await screen.findByText('HOME-CORPORATIVA')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: /Estamos a chegar/ })).not.toBeInTheDocument();
  });

  test('com sessão: vai para o dashboard do papel e nem lê o interruptor', async () => {
    lancamento({ enabled: true });
    sessao = { user: { id: 'u1', role: 'COMPRADOR' }, loading: false };
    render(<MemoryRouter initialEntries={['/']}><Routes><Route path="/" element={<Landing />} /><Route path="/comprador" element={<div>DASH-COMPRADOR</div>} /></Routes></MemoryRouter>);
    expect(await screen.findByText('DASH-COMPRADOR')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(screen.queryByText('Brevemente!')).not.toBeInTheDocument();
  });

  test('enquanto a sessão carrega não mostra nada (nem lê o interruptor)', () => {
    lancamento({ enabled: true });
    sessao = { user: null, loading: true };
    const { container } = render(<MemoryRouter initialEntries={['/']}><Routes><Route path="/" element={<Landing />} /></Routes></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('rotas directas (App completa)', () => {
  test.each([['/em-breve', 'Estamos a chegar…'], ['/institucional', 'HOME-CORPORATIVA'], ['/login', 'LOGIN']])('%s abre com o interruptor ligado', async (caminho, texto) => {
    lancamento({ enabled: true });
    render(<MemoryRouter initialEntries={[caminho]}><App /></MemoryRouter>);
    expect(await screen.findByText(texto)).toBeInTheDocument();
  });

  test('/em-breve também abre com o interruptor desligado', async () => {
    lancamento({ enabled: false });
    render(<MemoryRouter initialEntries={['/em-breve']}><App /></MemoryRouter>);
    expect(await screen.findByText('Brevemente!')).toBeInTheDocument();
  });
});

describe('ComingSoon', () => {
  test('conteúdo da imagem de lançamento, uma só h1, título do separador e marca', async () => {
    const { container } = render(<MemoryRouter><ComingSoon /></MemoryRouter>);
    expect(screen.getAllByRole('heading')).toHaveLength(1);
    expect(screen.getByText('O maior ecossistema africano de catálogos digitais')).toBeInTheDocument();
    expect(screen.getByText('Procurement digital · Oil & Gas · África')).toBeInTheDocument();
    expect(screen.getByText('kixima.net')).toBeInTheDocument();
    expect(container.querySelector('.soon-wm')).toHaveTextContent('KIXIMA.NET');
    await waitFor(() => expect(document.title).toBe('KIXIMA.NET | Brevemente'));
  });
});
