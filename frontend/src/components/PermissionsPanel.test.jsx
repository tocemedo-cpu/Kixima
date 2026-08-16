// src/components/PermissionsPanel.test.jsx
// Gestão de áreas do Admin do Sistema, dentro do painel de Permissões.
//
// O QUE ISTO PROTEGE. Um assessor restrito que caia nesta página por engano
// (o menu já não mostra o link, mas o URL continua a existir) não pode ver
// "Sem perfis." e concluir que não há mais ninguém no sistema — o servidor
// devolve 403, e é isso que se testa aqui: a distinção entre "vazio" e
// "recusado" chega a quem está a olhar.

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { I18nProvider } from '../i18n';

const USERS = [
  { id: 'u-super', name: 'Ana Super', email: 'ana@kixima.co.ao', role: 'ADMIN_SISTEMA', active: true, adminAreas: [], createdAt: '2026-01-01' },
  { id: 'u-assessor', name: 'Bruno Suporte', email: 'bruno@kixima.co.ao', role: 'ADMIN_SISTEMA', active: true, adminAreas: ['suporte'], createdAt: '2026-01-02' },
];

const apiGet = vi.fn();
const apiPatch = vi.fn();

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u-super', role: 'ADMIN_SISTEMA', adminAreas: [] } }),
}));
vi.mock('../api/client', () => ({
  api: { get: (...a) => apiGet(...a), patch: (...a) => apiPatch(...a) },
}));

// eslint-disable-next-line import/first
import PermissionsPanel from './PermissionsPanel';

function montar(props = {}) {
  return render(
    <I18nProvider>
      <PermissionsPanel
        trail={['Sistema', 'Permissões']}
        title="Permissões"
        subtitle="."
        listUrl="/api/admin/users"
        statusUrl={(id) => `/api/admin/users/${id}/status`}
        areasUrl={(id) => `/api/admin/users/${id}/areas`}
        showCompany
        {...props}
      />
    </I18nProvider>,
  );
}

beforeEach(() => {
  apiGet.mockReset();
  apiPatch.mockReset();
});

describe('Como Super Admin', () => {
  test('a linha mostra o resumo "Super Admin" para quem tem adminAreas vazio, sem alargar a tabela', async () => {
    // O resumo é curto DE PROPÓSITO — os nomes por extenso lado a lado
    // ultrapassavam 1280px e cortavam as ações à direita da tabela. Os nomes
    // completos só aparecem depois de expandir (ver o teste seguinte).
    apiGet.mockResolvedValue(USERS);
    montar();
    expect(await screen.findByText('Ana Super')).toBeInTheDocument();
    expect(screen.getByText('Super Admin')).toBeInTheDocument();
    expect(screen.queryByText('Super Admin — todas as áreas')).not.toBeInTheDocument();
  });

  test('a linha do assessor mostra a área única, e "Editar" expande os chips completos', async () => {
    apiGet.mockResolvedValue(USERS);
    montar();
    await screen.findByText('Bruno Suporte');
    const linhaBruno = screen.getByText('Bruno Suporte').closest('tr');
    expect(within(linhaBruno).getByText('Suporte')).toBeInTheDocument();
    expect(within(linhaBruno).queryByRole('button', { name: 'Operação da Plataforma' })).not.toBeInTheDocument();

    fireEvent.click(within(linhaBruno).getByRole('button', { name: 'Editar' }));
    expect(await screen.findByRole('button', { name: 'Operação da Plataforma' })).toBeInTheDocument();
  });

  test('clicar numa área do assessor, depois de expandir, grava de imediato — sem botão "Guardar"', async () => {
    apiGet.mockResolvedValue(USERS);
    apiPatch.mockResolvedValue({ id: 'u-assessor', adminAreas: ['suporte', 'operacoes'] });
    montar();
    await screen.findByText('Bruno Suporte');
    const linhaBruno = screen.getByText('Bruno Suporte').closest('tr');
    fireEvent.click(within(linhaBruno).getByRole('button', { name: 'Editar' }));

    const botaoOperacoes = await screen.findByRole('button', { name: 'Operação da Plataforma' });
    fireEvent.click(botaoOperacoes);

    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith(
      '/api/admin/users/u-assessor/areas',
      { areas: ['suporte', 'operacoes'] },
    ));
  });

  test('a PRÓPRIA linha (a do utilizador autenticado) não tem sequer o botão "Editar"', async () => {
    apiGet.mockResolvedValue(USERS);
    montar();
    await screen.findByText('Ana Super');
    // Ana é u-super, o próprio utilizador autenticado neste teste — nem chega
    // a haver como abrir o editor para a própria conta.
    const linhaAna = screen.getByText('Ana Super').closest('tr');
    expect(within(linhaAna).queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
  });
});

describe('Sem permissão (assessor restrito a chegar aqui por engano)', () => {
  test('um 403 mostra a mensagem de acesso reservado, não uma tabela vazia', async () => {
    const erro = new Error('Esta ação está reservada ao Super Admin.');
    erro.status = 403;
    apiGet.mockRejectedValue(erro);
    montar();
    expect(await screen.findByText(/reservada ao Super Admin/)).toBeInTheDocument();
    expect(screen.queryByText('Sem perfis.')).not.toBeInTheDocument();
  });
});

describe('Sem manageAreas (CompanyPermissions) — comportamento inalterado', () => {
  test('sem areasUrl, não há coluna de Áreas nem chamada extra', async () => {
    apiGet.mockResolvedValue([{ id: 'u1', name: 'Zeca', email: 'z@empresa.co.ao', role: 'COMPRADOR', active: true, createdAt: '2026-01-01' }]);
    montar({ areasUrl: undefined, showCompany: false });
    await screen.findByText('Zeca');
    expect(screen.queryByText('Áreas')).not.toBeInTheDocument();
  });
});
