// src/pages/shared/OrderDetail.test.jsx
// Recusa do fornecedor com motivo obrigatório, a linha do tempo auditável, e
// os dois botões de PDF ("Visualizar" vs "Baixar") — as três peças novas do
// fluxo completo de PO.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { I18nProvider } from '../../i18n';

const apiGet = vi.fn();
const apiPatch = vi.fn();
vi.mock('../../api/client', () => ({
  api: { get: (...a) => apiGet(...a), patch: (...a) => apiPatch(...a) },
}));

let mockUser = { id: 'u1', role: 'FORNECEDOR', companyId: 'c-supplier', companyType: 'FORNECEDOR' };
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));

// eslint-disable-next-line import/first
import OrderDetail from './OrderDetail';

function RotaDestino({ etiqueta }) {
  const location = useLocation();
  return <div>{etiqueta} {location.search}</div>;
}

const PO_APROVADA = {
  id: 'po1', reference: 'PO-2026-000001', status: 'APROVADA', isCallOff: false,
  totalAmount: 1000000, currency: 'AOA', createdAt: '2026-01-01T09:00:00Z',
  items: [{ id: 'i1', productId: 'p1', quantity: 2, unitPrice: 500000, lineTotal: 1000000 }],
};

const HISTORY = [
  { id: 'e1', action: 'PO_CRIADA', actorName: 'Comprador Um', actorRole: 'COMPRADOR', createdAt: '2026-01-01T09:00:00Z', detail: { valor: '1000000', moeda: 'AOA' } },
  { id: 'e2', action: 'PO_APROVADA', actorName: 'Admin Empresa', actorRole: 'COMPANY_ADMIN', createdAt: '2026-01-01T10:00:00Z', detail: null },
];

function montar(id = 'po1') {
  return render(
    <MemoryRouter initialEntries={[`/ordens/${id}`]}>
      <I18nProvider>
        <Routes>
          <Route path="/ordens/:id" element={<OrderDetail />} />
          {/* Rotas de destino do PDF: só para confirmar que a navegação fica
              DENTRO da SPA (não abre aba/janela externa) — não é preciso
              montar o PrintableDocument a sério aqui. */}
          <Route path="/documento/po/:id" element={<RotaDestino etiqueta="DOC-PO" />} />
          <Route path="/documento/fatura/:id" element={<RotaDestino etiqueta="DOC-FATURA" />} />
        </Routes>
      </I18nProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  apiGet.mockReset(); apiPatch.mockReset();
  mockUser = { id: 'u1', role: 'FORNECEDOR', companyId: 'c-supplier', companyType: 'FORNECEDOR' };
  apiGet.mockImplementation((url) => {
    if (url === '/api/purchase-orders/po1') return Promise.resolve(PO_APROVADA);
    if (url === '/api/purchase-orders/po1/history') return Promise.resolve(HISTORY);
    return Promise.reject(new Error('rota inesperada: ' + url));
  });
});

describe('Recusa do fornecedor — motivo obrigatório', () => {
  test('o botão "Recusar PO" abre um formulário com o motivo por preencher', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Recusar PO' }));
    expect(await screen.findByLabelText('Motivo da recusa')).toBeInTheDocument();
    // Sem motivo escrito, a confirmação fica desativada — não dá para recusar em branco.
    expect(screen.getByRole('button', { name: 'Confirmar recusa' })).toBeDisabled();
  });

  test('confirmar envia o motivo escrito para /refuse', async () => {
    apiPatch.mockResolvedValue({ ...PO_APROVADA, status: 'RECUSADA_FORNECEDOR', refusalReason: 'Sem stock suficiente.' });
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Recusar PO' }));
    fireEvent.change(await screen.findByLabelText('Motivo da recusa'), { target: { value: 'Sem stock suficiente.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar recusa' }));

    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith('/api/purchase-orders/po1/refuse', { reason: 'Sem stock suficiente.' }));
  });

  test('o motivo da recusa aparece no aviso quando a PO já foi recusada', async () => {
    apiGet.mockImplementation((url) => {
      if (url === '/api/purchase-orders/po1') return Promise.resolve({ ...PO_APROVADA, status: 'RECUSADA_FORNECEDOR', refusalReason: 'Sem capacidade este mês.' });
      if (url === '/api/purchase-orders/po1/history') return Promise.resolve(HISTORY);
      return Promise.reject(new Error(url));
    });
    montar();
    expect(await screen.findByText(/Sem capacidade este mês\./)).toBeInTheDocument();
  });
});

describe('Linha do tempo', () => {
  test('mostra os eventos da API, com o ator e a ação', async () => {
    montar();
    expect(await screen.findByText('PO criada')).toBeInTheDocument();
    expect(screen.getByText('Aprovada pelo Company Admin')).toBeInTheDocument();
    expect(screen.getByText(/Comprador Um/)).toBeInTheDocument();
    expect(screen.getByText(/Admin Empresa/)).toBeInTheDocument();
  });

  test('sem eventos, mostra uma mensagem em vez de uma lista vazia', async () => {
    apiGet.mockImplementation((url) => {
      if (url === '/api/purchase-orders/po1') return Promise.resolve(PO_APROVADA);
      if (url === '/api/purchase-orders/po1/history') return Promise.resolve([]);
      return Promise.reject(new Error(url));
    });
    montar();
    expect(await screen.findByText('Ainda sem eventos registados.')).toBeInTheDocument();
  });
});

describe('PDF — Visualizar vs Baixar', () => {
  test('"Visualizar PDF" e "Baixar PDF" navegam dentro da própria SPA, sem abrir aba/janela externa', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {});
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Visualizar PDF (PO)' }));
    expect(await screen.findByText('DOC-PO')).toBeInTheDocument();
    expect(openSpy).not.toHaveBeenCalled();

    openSpy.mockRestore();
  });

  test('"Baixar PDF" navega para a mesma rota com ?baixar=1', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Baixar PDF (PO)' }));
    expect(await screen.findByText('DOC-PO ?baixar=1')).toBeInTheDocument();
  });
});
