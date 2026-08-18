// src/pages/shared/SuporteChat.test.jsx
// Suporte → Chat: vista do utilizador (lista de pedidos, abrir um, enviar
// mensagem) e a fronteira calma do painel do agente quando o assessor não
// tem a área Suporte (mesmo padrão de Home.test.jsx — um 403 aqui não é
// alarme).
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../../i18n';

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiPostForm = vi.fn();
vi.mock('../../api/client', () => ({
  api: { get: (...a) => apiGet(...a), post: (...a) => apiPost(...a), postForm: (...a) => apiPostForm(...a) },
}));

let mockUser = { id: 'u1', role: 'COMPRADOR', adminAreas: [] };
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));

const joinTicket = vi.fn();
const leaveTicket = vi.fn();
vi.mock('../../realtime/RealtimeContext', () => ({
  useRealtime: () => ({ socket: null, connected: false, joinTicket, leaveTicket, joinConversation: vi.fn(), leaveConversation: vi.fn() }),
}));

// eslint-disable-next-line import/first
import SuporteChat from './SuporteChat';

function montar() {
  return render(<MemoryRouter><I18nProvider><SuporteChat /></I18nProvider></MemoryRouter>);
}

const TICKETS = [
  { id: 't1', reference: 'SUP-2026-00001', subject: 'Fatura em falta', status: 'ABERTO' },
];

beforeEach(() => {
  apiGet.mockReset(); apiPost.mockReset(); apiPostForm.mockReset();
  apiPost.mockResolvedValue({});
  joinTicket.mockReset(); leaveTicket.mockReset();
  mockUser = { id: 'u1', role: 'COMPRADOR', adminAreas: [] };
  apiGet.mockImplementation((url) => {
    if (url === '/api/support/tickets') return Promise.resolve(TICKETS);
    if (url === '/api/support/tickets/t1/messages') return Promise.resolve([
      { id: 'm1', body: 'Olá, preciso de ajuda.', authorId: 'u1', createdAt: '2026-01-01T10:00:00Z' },
    ]);
    return Promise.reject(new Error('rota inesperada: ' + url));
  });
});

describe('Vista do utilizador', () => {
  test('lista os pedidos do utilizador', async () => {
    montar();
    expect(await screen.findByText('Fatura em falta')).toBeInTheDocument();
    expect(screen.getByText('#SUP-2026-00001')).toBeInTheDocument();
  });

  test('abrir um pedido carrega o histórico e entra na sala do socket', async () => {
    montar();
    fireEvent.click(await screen.findByText('Fatura em falta'));
    expect(await screen.findByText('Olá, preciso de ajuda.')).toBeInTheDocument();
    await waitFor(() => expect(joinTicket).toHaveBeenCalledWith('t1'));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/api/support/tickets/t1/read'));
  });

  test('enviar mensagem usa multipart (body) contra a rota do ticket', async () => {
    apiPostForm.mockResolvedValue({ id: 'm2' });
    montar();
    fireEvent.click(await screen.findByText('Fatura em falta'));
    await screen.findByText('Olá, preciso de ajuda.');

    const input = screen.getByPlaceholderText('Escreva uma mensagem…');
    fireEvent.change(input, { target: { value: 'Já tenho a resposta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    await waitFor(() => expect(apiPostForm).toHaveBeenCalled());
    const [url, formData] = apiPostForm.mock.calls[0];
    expect(url).toBe('/api/support/tickets/t1/messages');
    expect(formData.get('body')).toBe('Já tenho a resposta');
  });
});

describe('Painel do agente (ADMIN_SISTEMA)', () => {
  beforeEach(() => { mockUser = { id: 'admin1', role: 'ADMIN_SISTEMA', adminAreas: ['suporte'] }; });

  test('sem a área Suporte, mostra uma mensagem calma — não o painel', async () => {
    mockUser = { id: 'admin1', role: 'ADMIN_SISTEMA', adminAreas: ['cadastro'] };
    apiGet.mockImplementation((url) => {
      if (url === '/api/support/admin/queue') { const e = new Error('fora da área'); e.status = 403; return Promise.reject(e); }
      if (url === '/api/support/admin/my-tickets') return Promise.resolve([]);
      return Promise.reject(new Error('rota inesperada: ' + url));
    });
    montar();
    expect(await screen.findByText('Sem acesso a Suporte — fale com quem lhe deu acesso ao sistema.')).toBeInTheDocument();
  });

  test('com a área Suporte, mostra a fila', async () => {
    apiGet.mockImplementation((url) => {
      if (url === '/api/support/admin/queue') return Promise.resolve(TICKETS);
      if (url === '/api/support/admin/my-tickets') return Promise.resolve([]);
      return Promise.reject(new Error('rota inesperada: ' + url));
    });
    montar();
    expect(await screen.findByText('Fatura em falta')).toBeInTheDocument();
    expect(screen.getByText('Fila')).toBeInTheDocument();
  });
});
