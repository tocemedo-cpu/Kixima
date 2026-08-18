// src/pages/shared/ChatComercial.test.jsx
// Mensagens → Chat Comercial: lista de conversas da empresa, abrir uma,
// enviar mensagem, e o aviso de Trust & Safety que aparece sempre.
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

vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', companyId: 'c-buyer' } }) }));

const joinConversation = vi.fn();
const leaveConversation = vi.fn();
vi.mock('../../realtime/RealtimeContext', () => ({
  useRealtime: () => ({ socket: null, connected: false, joinTicket: vi.fn(), leaveTicket: vi.fn(), joinConversation, leaveConversation }),
}));

// eslint-disable-next-line import/first
import ChatComercial from './ChatComercial';

const CONVERSAS = [
  { id: 'conv1', counterpart: { name: 'Fornecedora Kianda' }, lastMessage: { body: 'Bom dia', createdAt: '2026-01-01T09:00:00Z' } },
];

function montar() {
  return render(<MemoryRouter><I18nProvider><ChatComercial /></I18nProvider></MemoryRouter>);
}

beforeEach(() => {
  apiGet.mockReset(); apiPost.mockReset(); apiPostForm.mockReset();
  apiPost.mockResolvedValue({});
  joinConversation.mockReset(); leaveConversation.mockReset();
  apiGet.mockImplementation((url) => {
    if (url === '/api/conversations') return Promise.resolve(CONVERSAS);
    if (url === '/api/conversations/conv1/messages') return Promise.resolve([
      { id: 'm1', body: 'Bom dia', senderCompanyId: 'c-supplier', createdAt: '2026-01-01T09:00:00Z' },
    ]);
    return Promise.reject(new Error('rota inesperada: ' + url));
  });
});

test('lista as conversas da empresa', async () => {
  montar();
  expect(await screen.findByText('Fornecedora Kianda')).toBeInTheDocument();
});

test('sem conversas, mostra o convite a iniciar uma a partir de um produto/pedido', async () => {
  apiGet.mockImplementation((url) => (url === '/api/conversations' ? Promise.resolve([]) : Promise.reject(new Error(url))));
  montar();
  expect(await screen.findByText('Sem conversas ainda — inicie uma a partir de um produto ou de um pedido.')).toBeInTheDocument();
});

test('abrir uma conversa mostra as mensagens, o aviso de segurança, e entra na sala do socket', async () => {
  montar();
  fireEvent.click(await screen.findByText('Fornecedora Kianda'));
  expect(await screen.findByText('Bom dia')).toBeInTheDocument();
  expect(screen.getByText(/recomendamos manter a negociação e o pagamento dentro do Kixima/)).toBeInTheDocument();
  await waitFor(() => expect(joinConversation).toHaveBeenCalledWith('conv1'));
  await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/api/conversations/conv1/read'));
});

test('enviar mensagem usa multipart contra a rota da conversa', async () => {
  apiPostForm.mockResolvedValue({ id: 'm2' });
  montar();
  fireEvent.click(await screen.findByText('Fornecedora Kianda'));
  await screen.findByText('Bom dia');

  fireEvent.change(screen.getByPlaceholderText('Escreva uma mensagem…'), { target: { value: 'Qual o preço?' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

  await waitFor(() => expect(apiPostForm).toHaveBeenCalled());
  const [url, formData] = apiPostForm.mock.calls[0];
  expect(url).toBe('/api/conversations/conv1/messages');
  expect(formData.get('body')).toBe('Qual o preço?');
});

test('mensagens da própria empresa aparecem do lado "mine"', async () => {
  apiGet.mockImplementation((url) => {
    if (url === '/api/conversations') return Promise.resolve(CONVERSAS);
    if (url === '/api/conversations/conv1/messages') return Promise.resolve([
      { id: 'm1', body: 'Minha mensagem', senderCompanyId: 'c-buyer', createdAt: '2026-01-01T09:00:00Z' },
    ]);
    return Promise.reject(new Error(url));
  });
  const { container } = montar();
  fireEvent.click(await screen.findByText('Fornecedora Kianda'));
  await screen.findByText('Minha mensagem');
  expect(container.querySelector('.chat-bubble-row.mine')).toBeInTheDocument();
});
