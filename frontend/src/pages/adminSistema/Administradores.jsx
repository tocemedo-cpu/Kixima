// src/pages/adminSistema/Administradores.jsx
// Administração → Administradores do Sistema. O único caminho para criar um
// assessor (ADMIN_SISTEMA) passa por aqui — não pelo cadastro público, não
// pela criação direta de utilizador. O Super Admin escolhe nome, email e
// áreas; o assessor só define a senha, no link que recebe por email.
import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../api/client';
import { Crumbs, PageHead, Pill, EmptyRow } from '../../components/BuyerUI';
import { ErrorBanner } from '../../components/Common';
import { ResumoDeAreas, AreasEditor } from '../../components/PermissionsPanel';
import { ADMIN_AREAS, ADMIN_AREA_LABELS, formatDateTime } from '../../domain';
import { useI18n } from '../../i18n';

const INVITE_TONE = { PENDENTE: 'pending', ACEITO: 'success', EXPIRADO: 'neutral', CANCELADO: 'danger' };
const INVITE_LABEL = { PENDENTE: 'Pendente', ACEITO: 'Ativo', EXPIRADO: 'Expirado', CANCELADO: 'Cancelado' };

function initials(n = '') { return n.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase(); }

export default function Administradores() {
  const { t } = useI18n();
  const { user: eu } = useAuth();
  const [assessores, setAssessores] = useState(null);
  const [invites, setInvites] = useState(null);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(null);
  const [expandido, setExpandido] = useState(null);
  const [modal, setModal] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [areas, setAreas] = useState([]);

  function loadAssessores() {
    api.get('/api/admin/users')
      .then((users) => setAssessores(users.filter((u) => u.role === 'ADMIN_SISTEMA')))
      .catch((e) => setError(e));
  }
  function loadInvites() { api.get('/api/admin/invites').then(setInvites).catch((e) => setError(e)); }
  useEffect(() => { loadAssessores(); loadInvites(); }, []);

  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 3500); };

  function openModal() { setModal(true); setFormError(''); setName(''); setEmail(''); setAreas([]); }
  function toggleFormArea(area) {
    setAreas((prev) => (prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]));
  }

  async function sendInvite(e) {
    e.preventDefault(); setFormError(''); setBusy('form');
    try {
      await api.post('/api/admin/invites', { name, email, adminAreas: areas });
      setModal(false);
      flash(t('Convite enviado com sucesso para o email do assessor.'));
      loadInvites();
    } catch (err) { setFormError(err); } finally { setBusy(null); }
  }
  async function resendInvite(id, to) {
    setBusy(id);
    try { await api.post(`/api/admin/invites/${id}/resend`); flash(t('Convite reenviado para {to}.', { to })); loadInvites(); }
    catch (e) { setError(e); } finally { setBusy(null); }
  }
  async function cancelInvite(id) {
    setBusy(id);
    try { await api.post(`/api/admin/invites/${id}/cancel`); flash(t('Convite cancelado.')); loadInvites(); }
    catch (e) { setError(e); } finally { setBusy(null); }
  }
  async function toggleArea(u, area) {
    const atuais = u.adminAreas || [];
    const novas = atuais.includes(area) ? atuais.filter((a) => a !== area) : [...atuais, area];
    setBusy(u.id);
    try { await api.patch(`/api/admin/users/${u.id}/areas`, { areas: novas }); loadAssessores(); }
    catch (e) { flash(e.message); } finally { setBusy(null); }
  }

  const invitesAtivos = (invites || []).filter((i) => i.status !== 'ACEITO');

  return (
    <div>
      {toast ? <div className="svc-toast">{toast}</div> : null}
      <Crumbs trail={['Configurações e Suporte', 'Administradores do Sistema']} />
      <PageHead
        title={t('Administradores do Sistema')}
        subtitle={t('Convide assessores e atribua-lhes as áreas administrativas a que devem ter acesso.')}
        actions={<button className="btn btn-accent" onClick={openModal}>{t('+ Adicionar Assessor')}</button>}
      />

      <ErrorBanner message={error} />

      {invitesAtivos.length > 0 && (
        <div className="bz-card bz-tablewrap" style={{ marginBottom: 16 }}>
          <div className="ca-panel-title">{t('Convites')} ({invitesAtivos.length})</div>
          <table className="bz-table">
            <thead><tr><th>{t('Nome')}</th><th>{t('Email')}</th><th>{t('Áreas')}</th><th>{t('Estado')}</th><th>{t('Enviado')}</th><th></th></tr></thead>
            <tbody>
              {invitesAtivos.map((iv) => (
                <tr key={iv.id}>
                  <td><div className="bz-supplier"><span className="bz-supplier-logo">{initials(iv.name)}</span><strong>{iv.name}</strong></div></td>
                  <td className="bz-muted">{iv.email}</td>
                  <td><ResumoDeAreas user={iv} /></td>
                  <td><Pill tone={INVITE_TONE[iv.status]}>{t(INVITE_LABEL[iv.status])}</Pill></td>
                  <td className="bz-muted">{iv.createdAt ? formatDateTime(iv.createdAt) : '—'}</td>
                  <td className="r">
                    <div className="bz-actions" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-sm" disabled={busy === iv.id} onClick={() => resendInvite(iv.id, iv.email)}>{t('Reenviar')}</button>
                      {iv.status !== 'CANCELADO' ? <button className="btn btn-ghost btn-sm" disabled={busy === iv.id} onClick={() => cancelInvite(iv.id)}>{t('Cancelar')}</button> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bz-card bz-tablewrap">
        <div className="ca-panel-title">{t('Assessores ativos')}</div>
        <table className="bz-table">
          <thead><tr><th>{t('Utilizador')}</th><th>{t('Registado')}</th><th>{t('Estado')}</th><th>{t('Áreas')}</th><th></th></tr></thead>
          <tbody>
            {!assessores ? <tr><td colSpan={5}><EmptyRow>{t('A carregar…')}</EmptyRow></td></tr>
              : assessores.length === 0 ? <tr><td colSpan={5}><EmptyRow>{t('Sem administradores.')}</EmptyRow></td></tr>
              : assessores.map((u) => {
                const podeEditarAreas = u.id !== eu.id;
                return (
                  <tr key={u.id}>
                    <td><div className="bz-supplier"><span className="bz-supplier-logo">{initials(u.name)}</span><div><strong>{u.name}</strong><span className="bz-supplier-loc">{u.email}</span></div></div></td>
                    <td className="bz-muted">{u.createdAt ? formatDateTime(u.createdAt) : '—'}</td>
                    <td><Pill tone={u.active ? 'success' : 'danger'}>{u.active ? t('Ativo') : t('Bloqueado')}</Pill></td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <ResumoDeAreas user={u} />
                          {podeEditarAreas ? (
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setExpandido(expandido === u.id ? null : u.id)}>
                              {expandido === u.id ? t('Fechar') : t('Editar')}
                            </button>
                          ) : null}
                        </div>
                        {podeEditarAreas && expandido === u.id ? (
                          <AreasEditor user={u} onToggle={toggleArea} busy={busy === u.id} podeEditar />
                        ) : null}
                      </div>
                    </td>
                    <td></td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="av-modal" onClick={() => setModal(false)}>
          <form className="hs-form" onClick={(e) => e.stopPropagation()} onSubmit={sendInvite}>
            <h3>{t('Adicionar Assessor')}</h3>
            <p className="bz-sub">{t('Informe o nome, o email e as áreas administrativas. O sistema gera o link único e envia o convite automaticamente.')}</p>
            <label className="field"><span>{t('Nome do assessor')}</span>
              <input value={name} onChange={(e) => setName(e.target.value)} required placeholder={t('Nome completo')} />
            </label>
            <label className="field"><span>{t('Email do assessor')}</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder={t('assessor@kixima.co.ao')} />
            </label>
            <div className="field">
              <span>{t('Áreas administrativas')}</span>
              <div className="chip-row" style={{ marginTop: 6 }}>
                {ADMIN_AREAS.map((area) => (
                  <button
                    key={area}
                    type="button"
                    className={`chip${areas.includes(area) ? ' chip-active' : ''}`}
                    onClick={() => toggleFormArea(area)}
                  >
                    {t(ADMIN_AREA_LABELS[area])}
                  </button>
                ))}
              </div>
            </div>
            <ErrorBanner message={formError} />
            <div className="hs-form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setModal(false)}>{t('Cancelar')}</button>
              <button type="submit" className="btn btn-accent" disabled={busy === 'form' || !areas.length}>
                {busy === 'form' ? t('A enviar…') : t('Salvar e enviar convite')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
