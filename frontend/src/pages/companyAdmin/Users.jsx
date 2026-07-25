// src/pages/companyAdmin/Users.jsx
// Usuários & Perfis — o Company Admin convida a equipa por link (Comprador,
// Vendedor, Financeiro), aceita os cadastros e gere o estado dos utilizadores.
// Estética do mockup; lógica de convite/ativar/remover preservada.
import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../api/client';
import { Crumbs, PageHead, Pill, Toolbar, EmptyRow } from '../../components/BuyerUI';
import { Icon } from '../../components/icons';
import { formatDateTime } from '../../domain';

const ROLE_OPTIONS = {
  CLIENTE: [{ value: 'COMPRADOR', label: 'Comprador' }, { value: 'FINANCEIRO', label: 'Financeiro' }],
  FORNECEDOR: [{ value: 'COMPRADOR', label: 'Comprador' }, { value: 'FORNECEDOR', label: 'Vendedor' }, { value: 'FINANCEIRO', label: 'Financeiro' }],
};
function roleLabel(role, companyType) {
  if (role === 'COMPANY_ADMIN') return 'Company Admin';
  if (role === 'FORNECEDOR') return companyType === 'FORNECEDOR' ? 'Vendedor' : 'Fornecedor';
  if (role === 'COMPRADOR') return 'Comprador';
  if (role === 'FINANCEIRO') return 'Financeiro';
  return role;
}
const ROLE_TONE = { COMPANY_ADMIN: 'danger', COMPRADOR: 'info', FORNECEDOR: 'success', FINANCEIRO: 'pending' };
const PERFIS = [
  { icon: 'cart', t: 'Comprador', d: 'Cria pedidos, solicita cotações e acompanha compras.' },
  { icon: 'suppliers', t: 'Vendedor', d: 'Envia propostas, negocia e acompanha oportunidades.' },
  { icon: 'payment', t: 'Financeiro', d: 'Gerencia pagamentos, faturas e reconciliações.' },
  { icon: 'approvals', t: 'Company Admin', d: 'Aprova processos, contratos e gere a equipa.' },
];

function initials(n = '') { return n.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase(); }

export default function Users() {
  const { user } = useAuth();
  const [company, setCompany] = useState(null);
  const [users, setUsers] = useState(null);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('COMPRADOR');
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(false);

  function loadUsers() { api.get('/api/companies/users').then(setUsers).catch((e) => setError(e.message)); }
  useEffect(() => {
    if (user.companyId) api.get(`/api/companies/${user.companyId}`).then(setCompany).catch(() => {});
    loadUsers();
  }, [user.companyId]);

  const options = company ? ROLE_OPTIONS[company.type] || [] : [];
  const companyType = company?.type;
  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 3500); };

  async function generateInvite(e) {
    e.preventDefault(); setError(''); setInvite(null); setBusy(true);
    try { const res = await api.post('/api/companies/invites', { role }); setInvite({ url: `${window.location.origin}/convite/${res.token}`, role: res.role }); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function accept(id, name) { try { await api.patch(`/api/companies/users/${id}/activate`); flash(`Cadastro de ${name} aceite.`); loadUsers(); } catch (e) { setError(e.message); } }
  async function reject(id, name) { try { await api.del(`/api/companies/users/${id}`); flash(`Cadastro de ${name} removido.`); loadUsers(); } catch (e) { setError(e.message); } }

  const pending = (users || []).filter((u) => !u.active);
  const list = (users || []).filter((u) => !q || u.name.toLowerCase().includes(q.toLowerCase()) || u.email.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      {toast ? <div className="svc-toast">{toast}</div> : null}
      <Crumbs trail={['Usuários & Perfis']} />
      <PageHead title="Usuários & Perfis" subtitle="Gerencie os usuários, perfis e permissões da empresa."
        actions={<button className="btn btn-accent" onClick={() => { setModal(true); setInvite(null); }}>+ Novo Usuário</button>} />

      {error ? <div className="empty-state" style={{ padding: 14 }}><p>{error}</p></div> : null}

      {pending.length > 0 && (
        <div className="bz-card bz-tablewrap" style={{ marginBottom: 16 }}>
          <div className="ca-panel-title">Cadastros pendentes ({pending.length})</div>
          <table className="bz-table">
            <tbody>
              {pending.map((u) => (
                <tr key={u.id}>
                  <td><div className="bz-supplier"><span className="bz-supplier-logo">{initials(u.name)}</span><div><strong>{u.name}</strong><span className="bz-supplier-loc">{u.email}</span></div></div></td>
                  <td><Pill tone={ROLE_TONE[u.role]}>{roleLabel(u.role, companyType)}</Pill></td>
                  <td className="r">
                    <div className="bz-actions" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn btn-accent btn-sm" onClick={() => accept(u.id, u.name)}>Aceitar</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => reject(u.id, u.name)}>Recusar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Toolbar placeholder="Buscar usuário…" q={q} onQ={setQ} />
      <div className="bz-card bz-tablewrap">
        <table className="bz-table">
          <thead><tr><th>Usuário</th><th>E-mail</th><th>Perfil</th><th>Status</th><th>Registado</th><th></th></tr></thead>
          <tbody>
            {!users ? <tr><td colSpan={6}><EmptyRow>A carregar…</EmptyRow></td></tr>
              : list.length === 0 ? <tr><td colSpan={6}><EmptyRow>Sem utilizadores.</EmptyRow></td></tr>
              : list.map((u) => (
                <tr key={u.id}>
                  <td><div className="bz-supplier"><span className="bz-supplier-logo">{initials(u.name)}</span><strong>{u.name}</strong></div></td>
                  <td className="bz-muted">{u.email}</td>
                  <td><Pill tone={ROLE_TONE[u.role]}>{roleLabel(u.role, companyType)}</Pill></td>
                  <td><Pill tone={u.active ? 'success' : 'pending'}>{u.active ? 'Ativo' : 'Pendente'}</Pill></td>
                  <td className="bz-muted">{u.createdAt ? formatDateTime(u.createdAt) : '—'}</td>
                  <td>
                    <div className="bz-actions">
                      {u.role !== 'COMPANY_ADMIN' ? <button className="bz-iconbtn" title="Remover" onClick={() => reject(u.id, u.name)}><Icon name="approvals" size={14} /></button> : null}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <h3 className="pf-h2">Perfis e Permissões</h3>
      <p className="bz-sub" style={{ marginTop: -6 }}>Defina os níveis de acesso e permissões que cada perfil terá na plataforma.</p>
      <div className="hs-quick">
        {PERFIS.map((p) => (
          <div className="hs-quickcard" key={p.t}>
            <span className="hs-quick-ico"><Icon name={p.icon} size={18} /></span>
            <div><strong>{p.t}</strong><span className="bz-sub2">{p.d}</span></div>
          </div>
        ))}
      </div>

      {modal && (
        <div className="av-modal" onClick={() => setModal(false)}>
          <form className="hs-form" onClick={(e) => e.stopPropagation()} onSubmit={generateInvite}>
            <h3>Novo Usuário — convite por link</h3>
            <p className="bz-sub">Escolha o perfil, gere o link e partilhe-o. A pessoa cria a conta e o cadastro fica pendente da sua aprovação.</p>
            <label className="field"><span>Perfil a convidar</span>
              <select value={role} onChange={(e) => setRole(e.target.value)}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
            </label>
            {invite ? (
              <div className="ca-invite">
                <span className="bz-sub2">Link de convite ({roleLabel(invite.role, companyType)}) — válido 7 dias:</span>
                <div className="ca-invite-row"><input readOnly value={invite.url} onFocus={(e) => e.target.select()} /><button type="button" className="btn btn-ghost btn-sm" onClick={() => { navigator.clipboard?.writeText(invite.url); flash('Link copiado.'); }}>Copiar</button></div>
              </div>
            ) : null}
            <div className="hs-form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setModal(false)}>Fechar</button>
              <button type="submit" className="btn btn-accent" disabled={busy || !options.length}>{busy ? 'A gerar…' : 'Gerar link'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
