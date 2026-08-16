// src/pages/companyAdmin/Home.jsx
// Dashboard do Company Admin — visão geral da empresa em tempo real, ligada a
// /api/company-admin/dashboard. Mantém o fluxo do KIXIMA (aprovar POs, equipa,
// contratos) e apresenta KPIs, volume de operações e atividade recente reais.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { Crumbs, PageHead, KpiRow, Pill } from '../../components/BuyerUI';
import { Icon } from '../../components/icons';
import { PO_STATUS, formatMoney, formatDateTime } from '../../domain';
import { useI18n } from '../../i18n';

export default function CompanyAdminHome() {
  const { t } = useI18n();
  const nav = useNavigate();
  const [d, setD] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api.get('/api/company-admin/dashboard').then(setD).catch((e) => setError(e.message)); }, []);

  if (error) return <div className="empty-state"><h3>{t('Não foi possível carregar')}</h3><p>{error}</p></div>;
  if (!d) return <div className="bz-empty">{t('A carregar…')}</div>;

  const max = Math.max(1, ...d.volume.map((v) => v.value));
  return (
    <div>
      <Crumbs trail={['Dashboard']} />
      <PageHead title="Dashboard" subtitle="Visão geral da sua empresa em tempo real." />

      <KpiRow cards={[
        // Só os que representam uma lista onde se AGE. "Volume de Negócios" é
        // um número informativo e fica sem ligação de propósito.
        { icon: 'orders', tone: 'info', label: 'Ordens de Compra', value: d.kpis.pedidos, sub: 'Total da empresa', to: '/empresa/aprovacoes' },
        { icon: 'truck', tone: 'pending', label: 'Em Execução', value: d.kpis.emExecucao, sub: 'A decorrer', to: '/empresa/aprovacoes' },
        { icon: 'payment', tone: 'success', label: 'Volume de Negócios', value: formatMoney(d.kpis.volumeNegocios), sub: 'Valor total' },
        { icon: 'approvals', tone: 'danger', label: 'POs a Aprovar', value: d.kpis.aprovarPO, sub: 'Requerem a sua ação', to: '/empresa/aprovacoes' },
      ]} />

      <div className="bz-layout">
        <div className="bz-panel">
          <div className="bz-head" style={{ marginBottom: 10 }}><h3 style={{ margin: 0 }}>{t('Volume de Operações')}</h3><span className="bz-muted">{t('Últimos 6 meses')}</span></div>
          <div className="ca-bars">
            {d.volume.map((v) => (
              <div className="ca-bar" key={v.label}>
                <div className="ca-bar-track"><div className="ca-bar-fill" style={{ height: `${Math.round((v.value / max) * 100)}%` }} title={formatMoney(v.value)} /></div>
                <span className="bz-muted">{v.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bz-panel">
          <div className="bz-head" style={{ marginBottom: 6 }}><h3 style={{ margin: 0 }}>{t('Atividade Recente')}</h3><a className="pf-link" href="/empresa/atividades">{t('Ver todas')}</a></div>
          {d.recent.map((r) => (
            <div className="hs-ticket" key={r.reference}>
              <div><strong>{t('PO')} {r.reference}</strong><span className="bz-sub2">{r.party}</span></div>
              <div className="hs-ticket-meta"><Pill tone={PO_STATUS[r.status]?.tone}>{PO_STATUS[r.status]?.label || r.status}</Pill><span className="bz-sub2">{formatDateTime(r.at)}</span></div>
            </div>
          ))}
        </div>
      </div>

      <h3 className="pf-h2">{t('Resumo Geral')}</h3>
      <KpiRow cards={[
        { icon: 'users', tone: 'info', label: 'Usuários Ativos', value: d.resumo.usuariosAtivos, sub: 'Na empresa', to: '/empresa/utilizadores' },
        { icon: 'contract', tone: 'success', label: 'Contratos Ativos', value: d.resumo.contratosAtivos, sub: `de ${d.resumo.totalContratos}`, to: '/empresa/contratos' },
        { icon: 'reception', tone: 'pending', label: 'Ordens Concluídas', value: d.resumo.concluidas, sub: 'Recebidas' },
        { icon: 'shield', tone: 'success', label: 'Compliance', value: `${d.resumo.compliance}%`, sub: 'Conformidade' },
      ]} />

      <div className="bz-panel ca-quick">
        <strong>{t('Ações Rápidas')}</strong>
        <div className="ca-quick-row">
          <button className="btn btn-ghost btn-sm" onClick={() => nav('/empresa/utilizadores')}><Icon name="users" size={14} /> {t('Novo Usuário')}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => nav('/empresa/aprovacoes')}><Icon name="approvals" size={14} /> {t('Aprovar POs')}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => nav('/empresa/relatorios')}><Icon name="report" size={14} /> {t('Relatório Executivo')}</button>
        </div>
      </div>
    </div>
  );
}
