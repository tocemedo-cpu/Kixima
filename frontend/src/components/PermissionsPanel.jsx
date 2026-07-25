// src/components/PermissionsPanel.jsx
// Painel de Permissões — bloquear/desbloquear perfis. Reutilizado pelo Admin do
// Sistema (todos os utilizadores) e pelo Company Admin (utilizadores da empresa).
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Crumbs, PageHead, KpiRow, Tabs, Pill, Toolbar, EmptyRow } from './BuyerUI';
import { ROLE_LABELS, formatDate } from '../domain';

const ROLE_TONE = { COMPANY_ADMIN: 'danger', COMPRADOR: 'info', FORNECEDOR: 'success', FINANCEIRO: 'pending', ADMIN_SISTEMA: 'neutral' };
const TABS = [{ key: '', label: 'Todos' }, { key: 'ativos', label: 'Ativos' }, { key: 'bloqueados', label: 'Bloqueados' }];

function initials(n = '') { return n.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase(); }

export default function PermissionsPanel({ trail, title, subtitle, listUrl, statusUrl, showCompany = false }) {
  const [users, setUsers] = useState(null);
  const [tab, setTab] = useState('');
  const [q, setQ] = useState('');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(null);

  function load() { api.get(listUrl).then(setUsers).catch(() => setUsers([])); }
  useEffect(load, [listUrl]);

  function flash(m) { setToast(m); setTimeout(() => setToast(''), 3000); }
  async function setStatus(u, active) {
    setBusy(u.id);
    try { await api.patch(statusUrl(u.id), { active }); flash(active ? `${u.name} desbloqueado.` : `${u.name} bloqueado.`); load(); }
    catch (e) { flash(e.message); } finally { setBusy(null); }
  }

  const all = users || [];
  const ativos = all.filter((u) => u.active).length;
  const bloqueados = all.length - ativos;
  let list = all;
  if (tab === 'ativos') list = all.filter((u) => u.active);
  else if (tab === 'bloqueados') list = all.filter((u) => !u.active);
  if (q) list = list.filter((u) => u.name.toLowerCase().includes(q.toLowerCase()) || u.email.toLowerCase().includes(q.toLowerCase()) || (u.companyName || '').toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      {toast ? <div className="svc-toast">{toast}</div> : null}
      <Crumbs trail={trail} />
      <PageHead title={title} subtitle={subtitle} />

      <KpiRow cards={[
        { icon: 'users', tone: 'info', label: 'Total de Perfis', value: all.length, sub: 'Contas' },
        { icon: 'certification', tone: 'success', label: 'Ativos', value: ativos, sub: 'Com acesso' },
        { icon: 'approvals', tone: 'danger', label: 'Bloqueados', value: bloqueados, sub: 'Sem acesso' },
      ]} />

      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      <Toolbar placeholder="Pesquisar por nome, email ou empresa…" q={q} onQ={setQ} />

      <div className="bz-card bz-tablewrap">
        <table className="bz-table">
          <thead><tr><th>Utilizador</th><th>Perfil</th>{showCompany ? <th>Empresa</th> : null}<th>Registado</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {!users ? <tr><td colSpan={showCompany ? 6 : 5}><EmptyRow>A carregar…</EmptyRow></td></tr>
              : list.length === 0 ? <tr><td colSpan={showCompany ? 6 : 5}><EmptyRow>Sem perfis.</EmptyRow></td></tr>
              : list.map((u) => (
                <tr key={u.id}>
                  <td><div className="bz-supplier"><span className="bz-supplier-logo">{initials(u.name)}</span><div><strong>{u.name}</strong><span className="bz-supplier-loc">{u.email}</span></div></div></td>
                  <td><Pill tone={ROLE_TONE[u.role]}>{ROLE_LABELS[u.role] || u.role}</Pill></td>
                  {showCompany ? <td className="bz-muted">{u.companyName || '—'}</td> : null}
                  <td className="bz-muted">{u.createdAt ? formatDate(u.createdAt) : '—'}</td>
                  <td><Pill tone={u.active ? 'success' : 'danger'}>{u.active ? 'Ativo' : 'Bloqueado'}</Pill></td>
                  <td className="r">
                    {u.role === 'COMPANY_ADMIN' && !showCompany ? null : (
                      u.active
                        ? <button className="btn btn-ghost btn-sm" disabled={busy === u.id} onClick={() => setStatus(u, false)}>Bloquear</button>
                        : <button className="btn btn-accent btn-sm" disabled={busy === u.id} onClick={() => setStatus(u, true)}>Desbloquear</button>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
