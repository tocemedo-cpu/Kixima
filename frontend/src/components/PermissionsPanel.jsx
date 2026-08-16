// src/components/PermissionsPanel.jsx
// Painel de Permissões — bloquear/desbloquear perfis. Reutilizado pelo Admin do
// Sistema (todos os utilizadores) e pelo Company Admin (utilizadores da empresa).
import { Fragment, useEffect, useState } from 'react';
import { api } from '../api/client';
import { Crumbs, PageHead, KpiRow, Tabs, Pill, Toolbar, EmptyRow } from './BuyerUI';
import { ROLE_LABELS, ADMIN_AREAS, ADMIN_AREA_LABELS, formatDate } from '../domain';
import { useI18n } from '../i18n';
import { useAuth } from '../auth/AuthContext';

const ROLE_TONE = { COMPANY_ADMIN: 'danger', COMPRADOR: 'info', FORNECEDOR: 'success', FINANCEIRO: 'pending', ADMIN_SISTEMA: 'neutral' };
const TABS = [{ key: '', label: 'Todos' }, { key: 'ativos', label: 'Ativos' }, { key: 'bloqueados', label: 'Bloqueados' }];

function initials(n = '') { return n.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase(); }

/**
 * Resumo compacto das áreas — o que cabe na LINHA da tabela.
 *
 * Áreas por extenso não cabem lado a lado numa coluna sem alargar a tabela
 * para lá do ecrã (foi medido: com os seis nomes por extenso, a tabela
 * ultrapassava 1280px e cortava as ações à direita). Aqui só se diz QUANTAS.
 */
function ResumoDeAreas({ user }) {
  const { t } = useI18n();
  const areas = user.adminAreas || [];
  if (areas.length === 0) return <Pill tone="neutral">{t('Super Admin')}</Pill>;
  if (areas.length === 1) return <Pill tone="info">{t(ADMIN_AREA_LABELS[areas[0]])}</Pill>;
  return <Pill tone="info">{t('{n} áreas', { n: areas.length })}</Pill>;
}

/**
 * Chips de área de um Admin do Sistema — vazio = Super Admin (acede a tudo).
 *
 * Cada clique grava de imediato (o mesmo padrão de Bloquear/Desbloquear ao
 * lado): não há um botão "Guardar" à parte a esquecer-se de premir. Vive numa
 * linha PRÓPRIA, a toda a largura da tabela — ver a nota em ResumoDeAreas
 * sobre porque não cabe dentro da coluna.
 */
function AreasEditor({ user, onToggle, busy, podeEditar }) {
  const { t } = useI18n();
  const semAreas = !user.adminAreas || user.adminAreas.length === 0;
  return (
    <div className="chip-row" style={{ marginBottom: 0 }}>
      {semAreas ? <Pill tone="neutral">{t('Super Admin — todas as áreas')}</Pill> : null}
      {ADMIN_AREAS.map((area) => {
        const ativa = (user.adminAreas || []).includes(area);
        return (
          <button
            key={area}
            type="button"
            className={`chip${ativa ? ' chip-active' : ''}`}
            disabled={!podeEditar || busy}
            onClick={() => onToggle(user, area)}
          >
            {t(ADMIN_AREA_LABELS[area])}
          </button>
        );
      })}
    </div>
  );
}

export default function PermissionsPanel({
  trail, title, subtitle, listUrl, statusUrl, areasUrl, showCompany = false,
}) {
  const { t } = useI18n();
  const { user: eu } = useAuth();
  const [users, setUsers] = useState(null);
  const [negado, setNegado] = useState(false);
  const [tab, setTab] = useState('');
  const [q, setQ] = useState('');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(null);
  const [expandido, setExpandido] = useState(null);

  function load() {
    setNegado(false);
    api.get(listUrl).then(setUsers).catch((e) => {
      // 403 aqui é "isto é reservado ao Super Admin", não "não há ninguém" —
      // uma tabela vazia dir-lhe-ia o oposto do que se passa.
      if (e.status === 403) setNegado(true);
      setUsers([]);
    });
  }
  useEffect(load, [listUrl]);

  function flash(m) { setToast(m); setTimeout(() => setToast(''), 3000); }
  async function setStatus(u, active) {
    setBusy(u.id);
    try { await api.patch(statusUrl(u.id), { active }); flash(active ? t('{name} desbloqueado.', { name: u.name }) : t('{name} bloqueado.', { name: u.name })); load(); }
    catch (e) { flash(e.message); } finally { setBusy(null); }
  }
  async function toggleArea(u, area) {
    const atuais = u.adminAreas || [];
    const novas = atuais.includes(area) ? atuais.filter((a) => a !== area) : [...atuais, area];
    setBusy(u.id);
    try { await api.patch(areasUrl(u.id), { areas: novas }); load(); }
    catch (e) { flash(e.message); } finally { setBusy(null); }
  }

  const all = users || [];
  const ativos = all.filter((u) => u.active).length;
  const bloqueados = all.length - ativos;
  let list = all;
  if (tab === 'ativos') list = all.filter((u) => u.active);
  else if (tab === 'bloqueados') list = all.filter((u) => !u.active);
  if (q) list = list.filter((u) => u.name.toLowerCase().includes(q.toLowerCase()) || u.email.toLowerCase().includes(q.toLowerCase()) || (u.companyName || '').toLowerCase().includes(q.toLowerCase()));

  const mostraAreas = Boolean(areasUrl);
  const colunas = 5 + (showCompany ? 1 : 0) + (mostraAreas ? 1 : 0);

  return (
    <div>
      {toast ? <div className="svc-toast">{toast}</div> : null}
      <Crumbs trail={trail} />
      <PageHead title={title} subtitle={subtitle} />

      {negado ? (
        <div className="bz-card" style={{ padding: 20 }}>
          {t('Esta gestão está reservada ao Super Admin (sem áreas restritas). Fale com quem lhe deu acesso ao sistema.')}
        </div>
      ) : (
        <>
          <KpiRow cards={[
            { icon: 'users', tone: 'info', label: 'Total de Perfis', value: all.length, sub: 'Contas' },
            { icon: 'certification', tone: 'success', label: 'Ativos', value: ativos, sub: 'Com acesso' },
            { icon: 'approvals', tone: 'danger', label: 'Bloqueados', value: bloqueados, sub: 'Sem acesso' },
          ]} />

          <Tabs tabs={TABS} value={tab} onChange={setTab} />
          <Toolbar placeholder="Pesquisar por nome, email ou empresa…" q={q} onQ={setQ} />

          <div className="bz-card bz-tablewrap">
            <table className="bz-table">
              <thead>
                <tr>
                  <th>{t('Utilizador')}</th><th>{t('Perfil')}</th>{showCompany ? <th>{t('Empresa')}</th> : null}
                  <th>{t('Registado')}</th><th>{t('Estado')}</th>{mostraAreas ? <th>{t('Áreas')}</th> : null}<th></th>
                </tr>
              </thead>
              <tbody>
                {!users ? <tr><td colSpan={colunas}><EmptyRow>A carregar…</EmptyRow></td></tr>
                  : list.length === 0 ? <tr><td colSpan={colunas}><EmptyRow>Sem perfis.</EmptyRow></td></tr>
                  : list.map((u) => {
                    const podeEditarAreas = mostraAreas && u.role === 'ADMIN_SISTEMA' && u.id !== eu.id;
                    return (
                    <Fragment key={u.id}>
                      <tr>
                        <td><div className="bz-supplier"><span className="bz-supplier-logo">{initials(u.name)}</span><div><strong>{u.name}</strong><span className="bz-supplier-loc">{u.email}</span></div></div></td>
                        <td><Pill tone={ROLE_TONE[u.role]}>{ROLE_LABELS[u.role] || u.role}</Pill></td>
                        {showCompany ? <td className="bz-muted">{u.companyName || '—'}</td> : null}
                        <td className="bz-muted">{u.createdAt ? formatDate(u.createdAt) : '—'}</td>
                        <td><Pill tone={u.active ? 'success' : 'danger'}>{u.active ? t('Ativo') : t('Bloqueado')}</Pill></td>
                        {mostraAreas ? (
                          <td>
                            {u.role === 'ADMIN_SISTEMA' ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <ResumoDeAreas user={u} />
                                {podeEditarAreas ? (
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => setExpandido(expandido === u.id ? null : u.id)}
                                  >
                                    {expandido === u.id ? t('Fechar') : t('Editar')}
                                  </button>
                                ) : null}
                              </div>
                            ) : <span className="bz-muted">—</span>}
                          </td>
                        ) : null}
                        <td className="r">
                          {u.role === 'COMPANY_ADMIN' && !showCompany ? null : (
                            u.active
                              ? <button className="btn btn-ghost btn-sm" disabled={busy === u.id} onClick={() => setStatus(u, false)}>{t('Bloquear')}</button>
                              : <button className="btn btn-accent btn-sm" disabled={busy === u.id} onClick={() => setStatus(u, true)}>{t('Desbloquear')}</button>
                          )}
                        </td>
                      </tr>
                      {podeEditarAreas && expandido === u.id ? (
                        <tr>
                          <td colSpan={colunas} style={{ background: 'var(--surface-2, #f7f8fa)' }}>
                            <AreasEditor user={u} onToggle={toggleArea} busy={busy === u.id} podeEditar />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
