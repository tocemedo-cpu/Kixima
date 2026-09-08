// src/pages/fornecedor/CatalogImport.test.jsx
// Aviso de plano antes do upload (carregamentoEmMassa é Pro), link do
// ficheiro-modelo, e exibição de avisos/contadores de valores por omissão.
import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../../i18n';

const PLANOS_SEM_PRO = [
  { plano: 'BASE', features: { carregamentoEmMassa: false } },
  { plano: 'CORE', features: { carregamentoEmMassa: false } },
];
const PLANOS_COM_PRO = [
  { plano: 'PRO', features: { carregamentoEmMassa: true } },
];

let getMock;
const mockUser = { companyId: 'c1', role: 'FORNECEDOR', companyPlan: 'CORE' };

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));
vi.mock('../../api/client', () => ({
  api: { get: (...args) => getMock(...args), upload: vi.fn() },
}));

// eslint-disable-next-line import/first
import CatalogImport from './CatalogImport';

function renderPage() {
  return render(
    <MemoryRouter>
      <I18nProvider><CatalogImport /></I18nProvider>
    </MemoryRouter>
  );
}

describe('Aviso de plano antes do upload', () => {
  test('plano CORE (sem carregamento em massa) mostra aviso e desativa o envio', async () => {
    mockUser.companyPlan = 'CORE';
    getMock = vi.fn(() => Promise.resolve({ planos: PLANOS_SEM_PRO }));
    renderPage();

    expect(await screen.findByText(/faz parte do plano PRO/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Importar catálogo/i })).toBeDisabled();
  });

  test('plano PRO não mostra aviso e mantém o envio disponível', async () => {
    mockUser.companyPlan = 'PRO';
    getMock = vi.fn(() => Promise.resolve({ planos: PLANOS_COM_PRO }));
    renderPage();

    await screen.findByRole('button', { name: /Importar catálogo/i });
    expect(screen.queryByText(/faz parte do plano PRO/)).toBeNull();
    expect(screen.getByRole('button', { name: /Importar catálogo/i })).not.toBeDisabled();
  });
});

describe('Ficheiro-modelo', () => {
  test('mostra um link de download do ficheiro-modelo', async () => {
    mockUser.companyPlan = 'PRO';
    getMock = vi.fn(() => Promise.resolve({ planos: PLANOS_COM_PRO }));
    renderPage();
    const link = await screen.findByRole('link', { name: /Descarregue o ficheiro-modelo/i });
    expect(link).toHaveAttribute('href', '/templates/catalogo-modelo.xlsx');
  });
});
