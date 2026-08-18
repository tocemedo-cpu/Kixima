// src/pages/adminSistema/SecurityAlerts.test.jsx
// Alertas de Segurança: fronteira calma quando falta a área Suporte, listagem
// por estado, e a reclassificação (falso positivo / resolvido) de um alerta.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { I18nProvider } from '../../i18n';

const apiGet = vi.fn();
const apiPatch = vi.fn();
vi.mock('../../api/client', () => ({ api: { get: (...a) => apiGet(...a), patch: (...a) => apiPatch(...a) } }));

// eslint-disable-next-line import/first
import SecurityAlerts from './SecurityAlerts';

const ALERTA = {
  id: 'al1', conversationId: 'conv1', level: 'HIGH', reason: 'Sinais detetados: pagamento fora da plataforma.',
  signals: ['pagamento_fora'], status: 'ABERTO', createdAt: '2026-01-01T09:00:00Z',
  conversation: { id: 'conv1', buyerCompanyId: 'c-buyer', supplierCompanyId: 'c-supplier', buyerCompany: 'Petro Angola', supplierCompany: 'Kianda' },
};

function montar() {
  return render(<I18nProvider><SecurityAlerts /></I18nProvider>);
}

beforeEach(() => {
  apiGet.mockReset(); apiPatch.mockReset();
});

test('sem a área Suporte, mostra uma mensagem calma — não o painel', async () => {
  apiGet.mockImplementation(() => { const e = new Error('fora da área'); e.status = 403; return Promise.reject(e); });
  montar();
  expect(await screen.findByText('Sem acesso a Suporte — fale com quem lhe deu acesso ao sistema.')).toBeInTheDocument();
});

test('lista os alertas em aberto', async () => {
  apiGet.mockImplementation((url, params) => {
    if (url === '/api/conversations/admin/alerts' && params?.status === 'ABERTO') return Promise.resolve([ALERTA]);
    return Promise.resolve([]);
  });
  montar();
  expect(await screen.findByText('Petro Angola ↔ Kianda')).toBeInTheDocument();
  expect(screen.getByText('Alto')).toBeInTheDocument();
});

test('abrir um alerta mostra o motivo e as mensagens da conversa sinalizada; reclassificar como falso positivo', async () => {
  apiGet.mockImplementation((url, params) => {
    if (url === '/api/conversations/admin/alerts' && params?.status === 'ABERTO') return Promise.resolve([ALERTA]);
    if (url === '/api/conversations/admin/conversations/conv1') return Promise.resolve({
      conversation: ALERTA.conversation,
      messages: [{ id: 'm1', body: 'Vamos pagar fora da plataforma.', senderCompanyId: 'c-buyer', createdAt: '2026-01-01T09:00:00Z' }],
    });
    return Promise.resolve([]);
  });
  apiPatch.mockResolvedValue({ id: 'al1', status: 'FALSO_POSITIVO' });

  montar();
  fireEvent.click(await screen.findByText('Petro Angola ↔ Kianda'));
  expect(await screen.findByText(ALERTA.reason)).toBeInTheDocument();
  expect(await screen.findByText('Vamos pagar fora da plataforma.')).toBeInTheDocument();

  const acoes = document.querySelector('.chat-alert-actions-row');
  fireEvent.click(within(acoes).getByRole('button', { name: 'Falso positivo' }));
  await waitFor(() => expect(apiPatch).toHaveBeenCalledWith(
    '/api/conversations/admin/alerts/al1', { status: 'FALSO_POSITIVO', decision: '' },
  ));
});
