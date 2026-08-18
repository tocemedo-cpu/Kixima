// src/pages/shared/PrintableDocument.test.jsx
// Documento imprimível: "Visualizar PDF" e "Baixar PDF" são dois botões
// distintos, mas os dois usam a mesma tecnologia (impressão do browser) — o
// que muda é só se ?baixar=1 dispara o diálogo automaticamente ao carregar.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { I18nProvider } from '../../i18n';

const apiGet = vi.fn();
vi.mock('../../api/client', () => ({ api: { get: (...a) => apiGet(...a) } }));

// eslint-disable-next-line import/first
import PrintableDocument from './PrintableDocument';

const PO = {
  id: 'po1', reference: 'PO-2026-000001', status: 'APROVADA', currency: 'AOA', createdAt: '2026-01-01T09:00:00Z',
  buyerCompany: { name: 'Petro Angola' }, supplierCompany: { name: 'Fornecedora Kianda' },
  items: [{ id: 'i1', productId: 'p1', quantity: 1, unitPrice: 100, lineTotal: 100, product: { name: 'Bomba' } }],
  totalAmount: 114,
};

function montar(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <I18nProvider>
        <Routes><Route path="/documento/po/:id" element={<PrintableDocument kind="po" />} /></Routes>
      </I18nProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  apiGet.mockReset();
  apiGet.mockResolvedValue(PO);
});

test('mostra os dois botões — Visualizar e Baixar PDF', async () => {
  montar('/documento/po/po1');
  expect(await screen.findByRole('button', { name: 'Visualizar PDF' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Baixar PDF' })).toBeInTheDocument();
});

test('sem ?baixar=1, não chama window.print sozinho', async () => {
  const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
  montar('/documento/po/po1');
  await screen.findByRole('button', { name: 'Visualizar PDF' });
  await new Promise((r) => setTimeout(r, 350));
  expect(printSpy).not.toHaveBeenCalled();
  printSpy.mockRestore();
});

test('com ?baixar=1, chama window.print automaticamente', async () => {
  const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
  montar('/documento/po/po1?baixar=1');
  await screen.findByRole('button', { name: 'Baixar PDF' });
  await waitFor(() => expect(printSpy).toHaveBeenCalled(), { timeout: 1000 });
  printSpy.mockRestore();
});
