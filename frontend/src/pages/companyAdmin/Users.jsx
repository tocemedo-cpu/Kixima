// src/pages/companyAdmin/Users.jsx
// Usuários & Perfis — o Company Admin convida a equipa por link (Comprador,
// Vendedor, Financeiro), aceita os cadastros e gere o estado dos utilizadores.
// Estética do mockup; lógica de convite/ativar/remover preservada.
import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../api/client';
import { Crumbs, PageHead, Pill, Toolbar, EmptyRow } from '../../components/BuyerUI';
import { ErrorBanner } from '../../components/Common';
import { Icon } from '../../components/icons';
import { formatDateTime } from '../../domain';
import { useI18n } from '../../i18n';

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
const INVITE_TONE = { PENDENTE: 'pending', ACEITO: 'success', EXPIRADO: 'neutral', CANCELADO: 'danger' };
const INVITE_LABEL = { PENDENTE: 'Pendente', ACEITO: 'Aceito', EXPIRADO: 'Expirado', CANCELADO: 'Cancelado' };
const PERFIS = [
  { icon: 'cart', t: 'Comprador', d: 'Cria pedidos, solicita cotações e acompanha compras.' },
  { icon: 'suppliers', t: 'Vendedor', d: 'Envia propostas, negocia e acompanha oportunidades.' },
  { icon: 'payment', t: 'Financeiro', d: 'Gerencia pagamentos, faturas e reconciliações.' },
  { icon: 'approvals', t: 'Company Admin', d: 'Aprova processos, contratos e gere a equipa.' },
];

function initials(n = '') { return n.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase(); }

export default function Users() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [company, setCompany] = useState(null);
  const [users, setUsers] = useState(null);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('COMPRADOR');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [invites, setInvites] = useState([]);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(false);

  function loadUsers() { api.get('/api/companies/users').then(setUsers).catch((e) => setError(e)); }
  function loadInvites() { api.get('/api/companies/invites').then(setInvites).catch(() => {}); }
  useEffect(() => {
    if (user.companyId) api.get(`/api/companies/${user.companyId}`).then(setCompany).catch(() => {});
    loadUsers();
    loadInvites();
  }, [user.companyId]);

  const options = company ? ROLE_OPTIONS[company.type] || [] : [];
  const companyType = company?.type;
  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 3500); };

  function openInviteModal() { setModal(true); setFormError(''); setName(''); setEmail(''); setRole(options[0]?.value || 'COMPRADOR'); }

  // Envia o convite automaticamente: gera o link e envia por email ao funcionário.
  async function sendInvite(e) {
    e.preventDefault(); setFormError(''); setBusy(true);
    try {
      await api.post('/api/companies/invites', { role, name, email });
      setModal(false);
      flash(t('Convite enviado com sucesso para o email do funcionário.'));
      loadInvites();
    } catch (err) { setFormError(err); } finally { setBusy(false); }
  }
  async function resendInvite(id, to) { try { await api.post(`/api/companies/invites/${id}/resend`); flash(t('Convite reenviado para {to}.', { to })); loadInvites(); } catch (e) { setError(e); } }
  async function cancelInvite(id) { try { await api.post(`/api/companies/invites/${id}/cancel`); flash(t('Convite cancelado.')); loadInvites(); } catch (e) { setError(e); } }
  async function accept(id, name) { try { await api.patch(`/api/companies/users/${id}/activate`); flash(t('Cadastro de {name} aceite.', { name })); loadUsers(); } catch (e) { setError(e); } }
  async function reject(id, name) { try { await api.del(`/api/companies/users/${id}`); flash(t('Cadastro de {name} removido.', { name })); loadUsers(); } catch (e) { setError(e); } }

  const pending = (users || []).filter((u) => !u.active);
  const list = (users || []).filter((u) => !q || u.name.toLowerCase().includes(q.toLowerCase()) || u.email.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      {toast ? <div className="svc-toast">{toast}</div> : null}
      <Crumbs trail={['Usuários & Perfis']} />
      <PageHead title="Usuários & Perfis" subtitle="Gerencie os usuários, perfis e permissões da empresa."
        actions={<button className="btn btn-accent" onClick={openInviteModal}>{t('+ Novo Usuário')}</button>} />

      {/* Banner e não caixa vazia: é aqui que se bate no limite de lugares do
          plano, e é o banner que sabe oferecer o caminho para o resolver. */}
      <ErrorBanner message={error} />

      {pending.length > 0 && (
        <div className="bz-card bz-tablewrap" style={{ marginBottom: 16 }}>
          <div className="ca-panel-title">{t('Cadastros pendentes')} ({pending.length})</div>
          <table className="bz-table">
            <tbody>
              {pending.map((u) => (
                <tr key={u.id}>
                  <td><div className="bz-supplier"><span className="bz-supplier-logo">{initials(u.name)}</span><div><strong>{u.name}</strong><span className="bz-supplier-loc">{u.email}</span></div></div></td>
                  <td><Pill tone={ROLE_TONE[u.role]}>{roleLabel(u.role, companyType)}</Pill></td>
                  <td className="r">
                    <div className="bz-actions" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn btn-accent btn-sm" onClick={() => accept(u.id, u.name)}>{t('Aceitar')}</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => reject(u.id, u.name)}>{t('Recusar')}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {invites.length > 0 && (
        <div className="bz-card bz-tablewrap" style={{ marginBottom: 16 }}>
          <div className="ca-panel-title">{t('Convites enviados')} ({invites.length})</div>
          <table className="bz-table">
            <thead><tr><th>{t('Funcionário')}</th><th>{t('E-mail')}</th><th>{t('Perfil')}</th><th>{t('Status')}</th><th>{t('Enviado')}</th><th></th></tr></thead>
            <tbody>
              {invites.map((iv) => (
                <tr key={iv.id}>
                  <td><div className="bz-supplier"><span className="bz-supplier-logo">{initials(iv.name)}</span><strong>{iv.name}</strong></div></td>
                  <td className="bz-muted">{iv.email}</td>
                  <td><Pill tone={ROLE_TONE[iv.role]}>{roleLabel(iv.role, companyType)}</Pill></td>
                  <td><Pill tone={INVITE_TONE[iv.status]}>{INVITE_LABEL[iv.status]}</Pill></td>
                  <td className="bz-muted">{iv.createdAt ? formatDateTime(iv.createdAt) : '—'}</td>
                  <td className="r">
                    {iv.status !== 'ACEITO' ? (
                      <div className="bz-actions" style={{ justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => resendInvite(iv.id, iv.email)}>{t('Reenviar')}</button>
                        {iv.status !== 'CANCELADO' ? <button className="btn btn-ghost btn-sm" onClick={() => cancelInvite(iv.id)}>{t('Cancelar')}</button> : null}
                      </div>
                    ) : null}
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
          <thead><tr><th>{t('Usuário')}</th><th>{t('E-mail')}</th><th>{t('Perfil')}</th><th>{t('Status')}</th><th>{t('Registado')}</th><th></th></tr></thead>
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
                      {u.role !== 'COMPANY_ADMIN' ? <button className="bz-iconbtn" title={t('Remover')} onClick={() => reject(u.id, u.name)}><Icon name="approvals" size={14} /></button> : null}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <h3 className="pf-h2">{t('Perfis e Permissões')}</h3>
      <p className="bz-sub" style={{ marginTop: -6 }}>{t('Defina os níveis de acesso e permissões que cada perfil terá na plataforma.')}</p>
      <div className="hs-quick">
        {PERFIS.map((p) => (
          <div className="hs-quickcard" key={p.t}>
            <span className="hs-quick-ico"><Icon name={p.icon} size={18} /></span>
            <div><strong>{t(p.t)}</strong><span className="bz-sub2">{t(p.d)}</span></div>
          </div>
        ))}
      </div>

      {modal && (
        <div className="av-modal" onClick={() => setModal(false)}>
          <form className="hs-form" onClick={(e) => e.stopPropagation()} onSubmit={sendInvite}>
            <h3>{t('Adicionar funcionário')}</h3>
            <p className="bz-sub">{t('Informe o nome, o email e o perfil. O sistema gera o link único e envia o convite automaticamente para o email do funcionário.')}</p>
            <label className="field"><span>{t('Nome do funcionário')}</span>
              <input value={name} onChange={(e) => setName(e.target.value)} required placeholder={t('Nome completo')} />
            </label>
            <label className="field"><span>{t('Email do funcionário')}</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder={t('funcionario@empresa.co.ao')} />
            </label>
            <label className="field"><span>{t('Perfil')}</span>
              <select value={role} onChange={(e) => setRole(e.target.value)}>{options.map((o) => <option key={o.value} value={o.value}>{t(o.label)}</option>)}</select>
            </label>
            {/* Banner e não parágrafo: o limite de lugares do plano bate AQUI,
                dentro do modal do convite, e é este o momento em que a pessoa
                quer subir de plano. Um texto vermelho sem saída deixava-a a
                fechar o modal sem saber o que fazer a seguir. */}
            <ErrorBanner message={formError} />
            <div className="hs-form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setModal(false)}>{t('Cancelar')}</button>
              <button type="submit" className="btn btn-accent" disabled={busy || !options.length}>{busy ? t('A enviar…') : t('Salvar e enviar convite')}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
