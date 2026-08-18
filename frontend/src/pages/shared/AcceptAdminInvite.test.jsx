// src/pages/shared/AcceptAdminInvite.test.jsx
// Página pública de aceitação do convite de Assessor: mostra as áreas
// atribuídas (só para leitura), pede só a senha, e nunca envia adminAreas no
// pedido — mesmo que alguém adulterasse o formulário.

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { I18nProvider } from '../../i18n';

const apiGet = vi.fn();
const apiPost = vi.fn();
vi.mock('../../api/client', () => ({
  api: { get: (...a) => apiGet(...a), post: (...a) => apiPost(...a) },
}));

// eslint-disable-next-line import/first
import AcceptAdminInvite from './AcceptAdminInvite';

function montar(token = 'token-de-teste') {
  return render(
    <MemoryRouter initialEntries={[`/convite-admin/${token}`]}>
      <I18nProvider>
        <Routes><Route path="/convite-admin/:token" element={<AcceptAdminInvite />} /></Routes>
      </I18nProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => { apiGet.mockReset(); apiPost.mockReset(); });

describe('Convite válido', () => {
  test('mostra nome, email e as áreas atribuídas, sem forma de as editar', async () => {
    apiGet.mockResolvedValue({ name: 'Assessora Nova', email: 'nova@kixima.co.ao', adminAreas: ['suporte', 'operacoes'] });
    montar();
    expect(await screen.findByText('Assessora Nova', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Suporte')).toBeInTheDocument();
    expect(screen.getByText('Operação da Plataforma')).toBeInTheDocument();
    // Chips de LEITURA — nenhum é um <button> clicável de seleção.
    expect(screen.queryAllByRole('button', { name: /Suporte|Operação da Plataforma/ })).toHaveLength(0);
  });

  test('submeter envia só password + termsAccepted — nunca adminAreas', async () => {
    apiGet.mockResolvedValue({ name: 'Assessora Nova', email: 'nova@kixima.co.ao', adminAreas: ['suporte'] });
    apiPost.mockResolvedValue({ id: 'u1', active: true });
    montar();
    await screen.findByText('Assessora Nova', { exact: false });

    const senhaInput = document.querySelector('input[type=password]');
    fireEvent.change(senhaInput, { target: { value: 'Senha-Assessor-12345' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Ativar conta/ }));

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith(
      '/api/admin/invite/token-de-teste/accept',
      { password: 'Senha-Assessor-12345', termsAccepted: true },
    ));
    expect(await screen.findByText('Conta ativada')).toBeInTheDocument();
  });
});

describe('Convite inválido', () => {
  test('token recusado mostra a mensagem do servidor, não um ecrã em branco', async () => {
    const erro = new Error('Este convite expirou.');
    apiGet.mockRejectedValue(erro);
    montar();
    expect(await screen.findByText('Convite inválido')).toBeInTheDocument();
    expect(screen.getByText(/expirou/)).toBeInTheDocument();
  });
});
