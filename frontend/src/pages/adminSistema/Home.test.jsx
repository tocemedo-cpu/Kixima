// src/pages/adminSistema/Home.test.jsx
// Regressão: um assessor sem a área Cadastro & Empresas via o painel inteiro
// desta página (Visão geral) trocado pelo banner de erro vermelho da
// aplicação, só porque /api/companies devolvia 403. Um 403 aqui é uma
// FRONTEIRA de área esperada, não uma falha — a diferença importa para quem
// acabou de entrar com a conta que lhe foi dada e via logo um alarme.

import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../../i18n';

const apiGet = vi.fn();
vi.mock('../../api/client', () => ({ api: { get: (...a) => apiGet(...a) } }));
// ErrorBanner (Common.jsx) chama useAuth() para decidir o que mostrar num erro
// de sessão — precisa de contexto mesmo neste teste não sendo sobre login.
vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', role: 'ADMIN_SISTEMA', adminAreas: [] } }),
}));

// eslint-disable-next-line import/first
import AdminHome from './Home';

function montar() {
  return render(<MemoryRouter><I18nProvider><AdminHome /></I18nProvider></MemoryRouter>);
}

test('403 (fora da área) mostra uma mensagem calma, não o banner de erro', async () => {
  const erro = new Error('Esta ação está fora das suas áreas.');
  erro.status = 403;
  apiGet.mockRejectedValue(erro);
  montar();

  expect(await screen.findByText('Sem acesso a Cadastro & Empresas')).toBeInTheDocument();
  expect(screen.queryByText(erro.message)).not.toBeInTheDocument();
});

test('uma falha genuína (não 403) continua a mostrar o banner de erro', async () => {
  const erro = new Error('Erro de rede.');
  apiGet.mockRejectedValue(erro);
  montar();
  expect(await screen.findByText('Erro de rede.')).toBeInTheDocument();
});

test('com acesso, mostra os números normalmente', async () => {
  apiGet.mockResolvedValue([
    { status: 'PENDENTE' }, { status: 'APROVADA' }, { status: 'APROVADA' },
  ]);
  montar();
  expect(await screen.findByText('Visão geral')).toBeInTheDocument();
  expect(screen.getByText('3')).toBeInTheDocument(); // total de empresas
});
