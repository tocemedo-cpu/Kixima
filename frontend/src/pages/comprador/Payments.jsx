// src/pages/comprador/Payments.jsx
// Pagamentos (item 7) — faturas das PO do comprador, KPIs financeiros e
// resumo lateral. Ligado a /api/buyer/payments.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { Crumbs, PageHead, KpiRow, Tabs, Pill, Toolbar, SupplierCell, EmptyRow } from '../../components/BuyerUI';
import { Icon } from '../../components/icons';
import { INVOICE_STATUS, formatMoney, formatDate } from '../../domain';
import { useI18n } from '../../i18n';

const TABS = [
  { key: '', label: 'Todos' }, { key: 'ABERTO', label: 'Em Aberto' },
  { key: 'CONCLUIDO', label: 'Concluídos' }, { key: 'ATRASADO', label: 'Atrasados' },
];

export default function Payments() {
  const { t } = useI18n();
  const nav = useNavigate();
  const [tab, setTab] = useState('');
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    api.get('/api/buyer/payments', { status: tab || undefined, q: q || undefined })
      .then(setData).catch((e) => setError(e.message));
  }, [tab, q]);

  const k = data?.kpis;
  return (
    <div>
      <Crumbs trail={['Home', 'Pagamento']} />
      <PageHead title="Pagamentos" subtitle="Acompanhe e gerencie todos os pagamentos das suas ordens de compra." />

      <KpiRow cards={[
        { icon: 'payment', tone: 'pending', label: 'Valor Total a Pagar', value: k ? formatMoney(k.aPagar) : '—', sub: 'Em aberto' },
        { icon: 'wallet', tone: 'success', label: 'Pagamentos Concluídos', value: k ? formatMoney(k.concluidos) : '—', sub: 'Este mês' },
        { icon: 'approvals', tone: 'danger', label: 'Pagamentos Atrasados', value: k ? formatMoney(k.atrasados) : '—', sub: 'Requer atenção' },
        { icon: 'invoice', tone: 'info', label: 'Valor Total das PO', value: k ? formatMoney(k.totalPO) : '—', sub: 'Todas as faturas' },
      ]} />

      <div className="bz-layout">
        <div>
          <Tabs tabs={TABS} value={tab} onChange={setTab} />
          <Toolbar placeholder="Pesquisar por nº da PO, fornecedor…" q={q} onQ={setQ} />
          {error ? <div className="empty-state"><p>{error}</p></div> : (
            <div className="bz-card bz-tablewrap">
              <table className="bz-table">
                <thead><tr>
                  <th>{t('Nº da PO')}</th><th>{t('Fornecedor')}</th><th>{t('Vencimento')}</th>
                  <th className="r">{t('Valor da PO')}</th><th className="r">{t('Valor Pago')}</th><th className="r">{t('Em Aberto')}</th>
                  <th>{t('Estado')}</th><th></th>
                </tr></thead>
                <tbody>
                  {!data ? <tr><td colSpan={8}><EmptyRow>A carregar…</EmptyRow></td></tr>
                    : data.items.length === 0 ? <tr><td colSpan={8}><EmptyRow>Sem pagamentos.</EmptyRow></td></tr>
                    : data.items.map((r) => (
                      <tr key={r.id}>
                        <td><span className="bz-mono">{r.reference}</span><span className="bz-sub2">{r.origin}</span></td>
                        <td><SupplierCell supplier={r.supplier} /></td>
                        <td>{formatDate(r.dueAt)}</td>
                        <td className="r">{formatMoney(r.amount, r.currency)}</td>
                        <td className="r">{formatMoney(r.paid, r.currency)}</td>
                        <td className="r"><strong style={{ color: r.open > 0 ? '#c0392b' : '#16884f' }}>{formatMoney(r.open, r.currency)}</strong></td>
                        <td><Pill tone={INVOICE_STATUS[r.status]?.tone}>{INVOICE_STATUS[r.status]?.label || r.status}</Pill></td>
                        <td>
                          <div className="bz-actions">
                            <button className="bz-iconbtn" title={t('Ver ordem')} onClick={() => nav(`/comprador/ordens/${r.poId}`)}><Icon name="search" size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bz-side">
          <div className="bz-panel">
            <h3>{t('Resumo Financeiro')}</h3>
            <div className="bz-panel-row"><span>{t('Valor Total das PO')}</span><strong>{k ? formatMoney(k.totalPO) : '—'}</strong></div>
            <div className="bz-panel-row"><span>{t('Total Pago')}</span><strong>{k ? formatMoney(k.concluidos) : '—'}</strong></div>
            <div className="bz-panel-row"><span>{t('Total em Aberto')}</span><strong style={{ color: '#c0392b' }}>{k ? formatMoney(k.aPagar) : '—'}</strong></div>
            <div className="bz-panel-row"><span>{t('Total Atrasado')}</span><strong style={{ color: '#c0392b' }}>{k ? formatMoney(k.atrasados) : '—'}</strong></div>
          </div>
          <div className="bz-panel">
            <h3>{t('Precisa de Ajuda?')}</h3>
            <p className="bz-sub">{t('Fale com a nossa equipa de suporte para qualquer questão sobre pagamentos.')}</p>
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => nav('/ajuda')}><Icon name="help" size={14} /> {t('Contactar Suporte')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
