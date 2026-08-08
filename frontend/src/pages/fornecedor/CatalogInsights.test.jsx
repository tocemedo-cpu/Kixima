// src/pages/fornecedor/CatalogInsights.test.jsx
// Regressão: as vistas Serviços/Promoções davam ecrã branco (ReferenceError em
// renderView). Este teste renderiza-as com dados e garante que não rebentam.
import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../../i18n';

const { PRODUCTS } = vi.hoisted(() => ({
  PRODUCTS: [
    { id: '1', name: 'Bomba Promo', category: 'Bombas e Compressores', unitPrice: 1000000, promoPrice: 800000, currency: 'AOA' },
    { id: '2', name: 'Inspeção UT', category: 'Inspeção & Ensaios', unitPrice: 500000, currency: 'AOA' },
    { id: '3', name: 'Válvula X', category: 'Válvulas', unitPrice: 200000, currency: 'AOA' },
  ],
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: { companyId: 'c1', role: 'FORNECEDOR' } }),
}));
vi.mock('../../api/client', () => ({
  api: { get: vi.fn(() => Promise.resolve(PRODUCTS)) },
}));

// eslint-disable-next-line import/first
import CatalogInsights from './CatalogInsights';

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <I18nProvider><CatalogInsights /></I18nProvider>
    </MemoryRouter>
  );
}

describe('CatalogInsights — regressão do ecrã branco', () => {
  test('Promoções renderiza e lista o produto em promoção (preço promo + original)', async () => {
    renderAt('/fornecedor/catalogo/promocoes');
    expect(await screen.findByText('Bomba Promo')).toBeInTheDocument();
    expect(screen.getByText(/800.000,00 Kz/)).toBeInTheDocument();
    expect(screen.getByText(/1.000.000,00 Kz/)).toBeInTheDocument(); // preço original riscado
  });

  test('Serviços lista só categorias de serviço (exclui produtos)', async () => {
    renderAt('/fornecedor/catalogo/servicos');
    expect(await screen.findByText('Inspeção UT')).toBeInTheDocument();
    expect(screen.queryByText('Válvula X')).toBeNull();
  });
});
