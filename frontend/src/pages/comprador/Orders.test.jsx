// src/pages/comprador/Orders.test.jsx
// Ordens de Compra do comprador: cada linha tem duas ações — ver o detalhe
// da PO e visualizar o PDF diretamente, sem passar pelo detalhe.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../../i18n';

const apiGet = vi.fn();
vi.mock('../../api/client', () => ({ api: { get: (...a) => apiGet(...a) } }));

// eslint-disable-next-line import/first
import Orders from './Orders';

const RESPONSE = {
  kpis: { total: 1, valorTotal: 1000000, emAndamento: 1, concluidas: 0, canceladas: 0 },
  items: [
    {
      id: 'po1', reference: 'PO-2026-000001', status: 'APROVADA', isCallOff: false,
      createdAt: '2026-01-01T09:00:00Z', paymentDueAt: null, itemsCount: 2,
      totalAmount: 1000000, currency: 'AOA', supplier: { name: 'Fornecedora Kianda' },
    },
  ],
  page: 1, pages: 1, total: 1,
};

function montar() {
  return render(
    <MemoryRouter>
      <I18nProvider><Orders /></I18nProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  apiGet.mockReset();
  apiGet.mockResolvedValue(RESPONSE);
});

test('cada linha tem "Ver detalhes" e "Visualizar PDF"', async () => {
  montar();
  await screen.findByText('PO-2026-000001');
  expect(screen.getByTitle('Ver detalhes')).toBeInTheDocument();
  expect(screen.getByTitle('Visualizar PDF')).toBeInTheDocument();
});

test('"Visualizar PDF" abre o documento numa nova aba, sem navegar para o detalhe', async () => {
  const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {});
  montar();
  await screen.findByText('PO-2026-000001');
  fireEvent.click(screen.getByTitle('Visualizar PDF'));
  expect(openSpy).toHaveBeenCalledWith('/documento/po/po1', '_blank');
  openSpy.mockRestore();
});
