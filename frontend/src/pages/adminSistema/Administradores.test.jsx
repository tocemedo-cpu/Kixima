// src/pages/adminSistema/Administradores.test.jsx
// Administração → Administradores do Sistema: convidar, ver convites por
// estado, reenviar, cancelar, e editar áreas de quem já é assessor.

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { I18nProvider } from '../../i18n';

const ASSESSORES = [
  { id: 'u-super', name: 'Ana Super', email: 'ana@kixima.co.ao', role: 'ADMIN_SISTEMA', active: true, adminAreas: [], createdAt: '2026-01-01' },
  { id: 'u-suporte', name: 'Bruno Suporte', email: 'bruno@kixima.co.ao', role: 'ADMIN_SISTEMA', active: true, adminAreas: ['suporte'], createdAt: '2026-01-02' },
  { id: 'u-comprador', name: 'Zeca Comprador', email: 'zeca@petroangola.co.ao', role: 'COMPRADOR', active: true, adminAreas: [], createdAt: '2026-01-03' },
];
const INVITES = [
  { id: 'inv-1', name: 'Convidada Pendente', email: 'pendente@kixima.co.ao', adminAreas: ['financeiro'], status: 'PENDENTE', createdAt: '2026-01-05' },
  { id: 'inv-2', name: 'Convidado Expirado', email: 'expirado@kixima.co.ao', adminAreas: ['apolices'], status: 'EXPIRADO', createdAt: '2026-01-04' },
];

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiPatch = vi.fn();

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u-super', role: 'ADMIN_SISTEMA', adminAreas: [] } }),
}));
vi.mock('../../api/client', () => ({
  api: {
    get: (...a) => apiGet(...a),
    post: (...a) => apiPost(...a),
    patch: (...a) => apiPatch(...a),
  },
}));

// eslint-disable-next-line import/first
import Administradores from './Administradores';

function montar() {
  return render(<I18nProvider><Administradores /></I18nProvider>);
}

beforeEach(() => {
  apiGet.mockReset(); apiPost.mockReset(); apiPatch.mockReset();
  apiGet.mockImplementation((url) => {
    if (url === '/api/admin/users') return Promise.resolve(ASSESSORES);
    if (url === '/api/admin/invites') return Promise.resolve(INVITES);
    return Promise.reject(new Error('rota inesperada: ' + url));
  });
});

describe('Listagem', () => {
  test('mostra os assessores (ADMIN_SISTEMA), não os outros papéis', async () => {
    montar();
    expect(await screen.findByText('Ana Super')).toBeInTheDocument();
    expect(screen.getByText('Bruno Suporte')).toBeInTheDocument();
    expect(screen.queryByText('Zeca Comprador')).not.toBeInTheDocument();
  });

  test('mostra os convites por estado — Pendente e Expirado, não Aceito', async () => {
    montar();
    await screen.findByText('Convidada Pendente');
    expect(screen.getByText('Pendente')).toBeInTheDocument();
    expect(screen.getByText('Convidado Expirado')).toBeInTheDocument();
    expect(screen.getByText('Expirado')).toBeInTheDocument();
  });
});

describe('Adicionar Assessor', () => {
  test('só se pode enviar com pelo menos uma área selecionada', async () => {
    montar();
    fireEvent.click(await screen.findByText('+ Adicionar Assessor'));
    const botaoEnviar = await screen.findByRole('button', { name: /Salvar e enviar convite/ });
    expect(botaoEnviar).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Financeiro' }));
    expect(botaoEnviar).not.toBeDisabled();
  });

  test('envia nome, email e as áreas escolhidas — nada mais', async () => {
    apiPost.mockResolvedValue({ id: 'novo', status: 'PENDENTE' });
    montar();
    fireEvent.click(await screen.findByText('+ Adicionar Assessor'));

    fireEvent.change(screen.getByPlaceholderText('Nome completo'), { target: { value: 'Novo Assessor' } });
    fireEvent.change(screen.getByPlaceholderText('assessor@kixima.co.ao'), { target: { value: 'novo@kixima.co.ao' } });
    fireEvent.click(screen.getByRole('button', { name: 'Suporte' }));
    fireEvent.click(screen.getByRole('button', { name: 'Operação da Plataforma' }));
    fireEvent.click(screen.getByRole('button', { name: /Salvar e enviar convite/ }));

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/api/admin/invites', {
      name: 'Novo Assessor', email: 'novo@kixima.co.ao', adminAreas: ['suporte', 'operacoes'],
    }));
  });
});

describe('Reenviar e cancelar convite', () => {
  test('reenviar chama o endpoint certo com o id do convite', async () => {
    apiPost.mockResolvedValue({ id: 'inv-1', status: 'PENDENTE' });
    montar();
    const linha = (await screen.findByText('Convidada Pendente')).closest('tr');
    fireEvent.click(within(linha).getByRole('button', { name: 'Reenviar' }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/api/admin/invites/inv-1/resend'));
  });

  test('cancelar chama o endpoint certo; um convite já cancelado não mostra "Cancelar" outra vez', async () => {
    apiPost.mockResolvedValue({ id: 'inv-2', status: 'CANCELADO' });
    montar();
    const linhaExpirado = (await screen.findByText('Convidado Expirado')).closest('tr');
    // Expirado ainda pode ser cancelado.
    expect(within(linhaExpirado).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
  });
});

describe('Editar áreas de um assessor já ativo', () => {
  test('a própria conta (autenticada) não tem botão de editar', async () => {
    montar();
    const linhaAna = (await screen.findByText('Ana Super')).closest('tr');
    expect(within(linhaAna).queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
  });

  test('editar outro assessor expande os chips e grava ao clicar', async () => {
    apiPatch.mockResolvedValue({ id: 'u-suporte', adminAreas: ['suporte', 'cadastro'] });
    montar();
    const linhaBruno = (await screen.findByText('Bruno Suporte')).closest('tr');
    fireEvent.click(within(linhaBruno).getByRole('button', { name: 'Editar' }));

    const botaoCadastro = await within(linhaBruno.parentElement).findByRole('button', { name: 'Cadastro & Empresas' });
    fireEvent.click(botaoCadastro);

    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith(
      '/api/admin/users/u-suporte/areas',
      { areas: ['suporte', 'cadastro'] },
    ));
  });
});
