// src/pages/financeiro/Home.jsx
// Centro Financeiro — visão geral da saúde financeira e faturas a pagar.
// Ligado a /api/financeiro/overview (dados reais das faturas da empresa).
// Numa empresa FORNECEDORA, o mesmo perfil vê o LADO DE QUEM RECEBE:
// pagamentos recebidos (com confirmação de receção) e Taxa KIXIMA.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../api/client';
import { Crumbs, PageHead, KpiRow, Pill } from '../../components/BuyerUI';
import { Icon } from '../../components/icons';
import { INVOICE_STATUS, formatMoney, formatDate } from '../../domain';
import { useI18n } from '../../i18n';

// Centro Financeiro de uma empresa FORNECEDORA: recebimentos + Taxa KIXIMA.
function SupplierFinanceCenter() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [orders, setOrders] = useState(null);
  const [fees, setFees] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/purchase-orders').then(setOrders).catch((e) => setError(e.message));
    api.get(`/api/companies/${user.companyId}/platform-fees`).then(setFees).catch(() => {});
  }, [user.companyId]);

  if (error) return <div className="empty-state"><h3>Não foi possível carregar</h3><p>{error}</p></div>;
  if (!orders) return <div className="bz-empty">A carregar…</div>;

  const payments = orders.filter((o) => o.invoice?.payment).map((o) => o.invoice.payment);
  const sum = (list) => list.reduce((s, p) => s + Number(p.amount), 0);
  const confirmados = payments.filter((p) => p.receivedAt);
  const porConfirmar = payments.filter((p) => !p.receivedAt);

  return (
    <div>
      <Crumbs trail={['Financeiro', 'Centro Financeiro']} />
      <PageHead title="Centro Financeiro" subtitle="O lado de quem recebe: pagamentos dos clientes e Taxa KIXIMA." />

      <KpiRow cards={[
        { icon: 'wallet', tone: 'success', label: 'Recebido (confirmado)', value: formatMoney(sum(confirmados)), sub: `${confirmados.length} pagamentos` },
        { icon: 'payment', tone: 'pending', label: 'Por confirmar receção', value: formatMoney(sum(porConfirmar)), sub: `${porConfirmar.length} pagamentos` },
        { icon: 'invoice', tone: 'info', label: 'Taxa KIXIMA por liquidar', value: fees ? formatMoney(fees.kpis.pendingAOA) : '—', sub: fees ? `${fees.kpis.pendentes} taxas pendentes` : '' },
        { icon: 'orders', tone: 'neutral', label: 'Pagamentos no total', value: payments.length, sub: 'Histórico completo' },
      ]} />

      <div className="bz-layout">
        <div className="bz-panel">
          <div className="bz-head" style={{ marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Por confirmar receção</h3>
            <a className="pf-link" href="/financeiro/recebidos">Ver todos</a>
          </div>
          {porConfirmar.length === 0 ? <p className="bz-sub">Nada por confirmar — está tudo em dia.</p> : (
            porConfirmar.slice(0, 6).map((p) => (
              <div className="hs-ticket" key={p.id}>
                <div><strong className="bz-mono">{p.reference}</strong><span className="bz-sub2">processado {formatDate(p.processedAt)}</span></div>
                <div className="hs-ticket-meta"><strong>{formatMoney(p.amount, p.currency)}</strong></div>
              </div>
            ))
          )}
          <button className="btn btn-accent" style={{ width: '100%', marginTop: 10 }} onClick={() => nav('/financeiro/recebidos')}>
            <Icon name="payment" size={14} /> Confirmar receções
          </button>
        </div>
        <div className="bz-panel">
          <h3 style={{ marginTop: 0 }}>Taxa KIXIMA</h3>
          {fees ? (
            <>
              <p className="bz-sub" style={{ marginTop: 8 }}>
                {fees.kpis.pendentes > 0
                  ? <>Tem <strong>{formatMoney(fees.kpis.pendingAOA)}</strong> por liquidar à plataforma.</>
                  : 'Sem taxas pendentes — está tudo liquidado.'}
              </p>
              <p className="bz-sub2">Total gerado: {formatMoney(fees.kpis.totalAOA)} · Cobrado: {formatMoney(fees.kpis.chargedAOA)}</p>
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => window.open(`/documento/taxas/${user.companyId}`, '_blank')}>
                Ver extrato completo
              </button>
            </>
          ) : <p className="bz-sub">Sem dados de taxas.</p>}
        </div>
      </div>
    </div>
  );
}

export default function FinanceiroHome() {
  const { t } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const [d, setD] = useState(null);
  const [error, setError] = useState('');

  const isSupplierSide = user.companyType === 'FORNECEDOR';
  useEffect(() => {
    if (isSupplierSide) return; // a variante fornecedora carrega os seus próprios dados
    api.get('/api/financeiro/overview').then(setD).catch((e) => setError(e.message));
  }, [isSupplierSide]);

  if (isSupplierSide) return <SupplierFinanceCenter />;

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
