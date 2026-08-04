// src/pages/financeiro/Home.jsx
// Centro Financeiro — visão geral da saúde financeira e faturas a pagar.
// Ligado a /api/financeiro/overview (dados reais das faturas da empresa).
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { Crumbs, PageHead, KpiRow, Pill } from '../../components/BuyerUI';
import { Icon } from '../../components/icons';
import { INVOICE_STATUS, formatMoney, formatDate } from '../../domain';
import { useI18n } from '../../i18n';

export default function FinanceiroHome() {
  const { t } = useI18n();
  const nav = useNavigate();
  const [d, setD] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api.get('/api/financeiro/overview').then(setD).catch((e) => setError(e.message)); }, []);

  if (error) return <div className="empty-state"><h3>{t('Não foi possível carregar')}</h3><p>{error}</p></div>;
  if (!d) return <div className="bz-empty">A carregar…</div>;
  const max = Math.max(1, ...d.series.map((s) => Math.max(s.faturas, s.pagamentos)));

  return (
    <div>
      <Crumbs trail={['Financeiro', 'Centro Financeiro']} />
      <PageHead title="Centro Financeiro" subtitle="Visão geral da saúde financeira e atividades pendentes." />

      <KpiRow cards={[
        { icon: 'payment', tone: 'danger', label: 'Pagamentos Pendentes', value: formatMoney(d.kpis.pagamentosPendentes), sub: `${d.kpis.pagamentosPendentesCount} faturas` },
        { icon: 'invoice', tone: 'info', label: 'Faturas Recebidas', value: d.kpis.faturasRecebidas, sub: 'Total' },
        { icon: 'wallet', tone: 'success', label: 'Pagamentos (Mês)', value: formatMoney(d.kpis.pagosMes), sub: 'Processados' },
        { icon: 'approvals', tone: 'pending', label: 'A Aprovar/Pagar', value: d.kpis.aprovacoesPendentes, sub: `${d.kpis.aVencer7} a vencer em 7 dias` },
      ]} />

      <div className="bz-layout">
        <div className="bz-panel">
          <div className="bz-head" style={{ marginBottom: 10 }}><h3 style={{ margin: 0 }}>{t('Visão Geral Financeira')}</h3><span className="bz-muted">Últimos 6 meses</span></div>
          <div className="rp-legend"><span><i style={{ background: '#2f6fd6' }} /> Faturas</span><span><i style={{ background: '#16a066' }} /> Pagamentos</span></div>
          <div className="ca-bars">
            {d.series.map((s) => (
              <div className="ca-bar" key={s.label}>
                <div className="rp-barpair">
                  <div className="ca-bar-track"><div className="ca-bar-fill" style={{ height: `${Math.round((s.faturas / max) * 100)}%`, background: '#2f6fd6' }} title={`Faturas ${formatMoney(s.faturas)}`} /></div>
                  <div className="ca-bar-track"><div className="ca-bar-fill" style={{ height: `${Math.round((s.pagamentos / max) * 100)}%`, background: '#16a066' }} title={`Pagamentos ${formatMoney(s.pagamentos)}`} /></div>
                </div>
                <span className="bz-muted">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bz-panel">
          <div className="bz-head" style={{ marginBottom: 6 }}><h3 style={{ margin: 0 }}>{t('Faturas a Pagar')}</h3><a className="pf-link" href="/financeiro/faturas">Ver todas</a></div>
          {d.pendentes.length === 0 ? <p className="bz-sub">Sem faturas pendentes.</p> : d.pendentes.map((i) => (
            <div className="hs-ticket" key={i.id}>
              <div><strong>{i.supplier}</strong><span className="bz-sub2 bz-mono">{i.reference}</span></div>
              <div className="hs-ticket-meta"><strong>{formatMoney(i.amount, i.currency)}</strong><span className="bz-sub2">vence {formatDate(i.dueAt)}</span></div>
            </div>
          ))}
          <button className="btn btn-accent" style={{ width: '100%', marginTop: 10 }} onClick={() => nav('/financeiro/faturas')}><Icon name="payment" size={14} /> Aprovar Pagamentos</button>
        </div>
      </div>
    </div>
  );
}
