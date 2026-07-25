// src/pages/financeiro/PaymentHistory.jsx
// Pagamentos — todas as faturas da empresa (pagas, pendentes, vencidas) com
// KPIs. Ligado a /api/financeiro/payments.
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { Crumbs, PageHead, KpiRow, Tabs, Pill, Toolbar, SupplierCell, EmptyRow } from '../../components/BuyerUI';
import { INVOICE_STATUS, formatMoney, formatDate } from '../../domain';

const TABS = [
  { key: '', label: 'Todos' }, { key: 'PENDENTE', label: 'Pendentes' },
  { key: 'PAGO', label: 'Pagos' }, { key: 'VENCIDO', label: 'Vencidos' },
];

export default function PaymentHistory() {
  const [tab, setTab] = useState('');
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api.get('/api/financeiro/payments', { status: tab || undefined }).then(setData).catch((e) => setError(e.message)); }, [tab]);

  const k = data?.kpis;
  const now = Date.now();
  const items = (data?.items || []).filter((i) => !q || i.reference.toLowerCase().includes(q.toLowerCase()) || (i.supplier || '').toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <Crumbs trail={['Financeiro', 'Pagamentos']} />
      <PageHead title="Pagamentos" subtitle="Gerencie e acompanhe todos os pagamentos das faturas da empresa." />

      <KpiRow cards={[
        { icon: 'payment', tone: 'pending', label: 'Total a Pagar', value: k ? formatMoney(k.aPagar) : '—', sub: 'Em aberto' },
        { icon: 'wallet', tone: 'success', label: 'Pagos (Mês)', value: k ? formatMoney(k.pagosMes) : '—', sub: 'Processados' },
        { icon: 'approvals', tone: 'danger', label: 'Vencidos', value: k ? formatMoney(k.vencidos) : '—', sub: 'Requerem atenção' },
        { icon: 'invoice', tone: 'info', label: 'Total de Faturas', value: k?.total ?? '—', sub: 'Da empresa' },
      ]} />

      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      <Toolbar placeholder="Pesquisar por nº ou fornecedor…" q={q} onQ={setQ} />

      {error ? <div className="empty-state"><p>{error}</p></div> : (
        <div className="bz-card bz-tablewrap">
          <table className="bz-table">
            <thead><tr><th>Nº da Fatura</th><th>Fornecedor</th><th>PO</th><th className="r">Valor</th><th>Vencimento</th><th>Pago em</th><th>Status</th></tr></thead>
            <tbody>
              {!data ? <tr><td colSpan={7}><EmptyRow>A carregar…</EmptyRow></td></tr>
                : items.length === 0 ? <tr><td colSpan={7}><EmptyRow>Sem pagamentos.</EmptyRow></td></tr>
                : items.map((i) => {
                  const overdue = i.status === 'PENDENTE' && new Date(i.dueAt).getTime() < now;
                  return (
                    <tr key={i.id}>
                      <td><span className="bz-mono">{i.reference}</span></td>
                      <td><SupplierCell supplier={{ name: i.supplier }} /></td>
                      <td className="bz-muted bz-mono">{i.poReference || '—'}</td>
                      <td className="r"><strong>{formatMoney(i.amount, i.currency)}</strong></td>
                      <td>{formatDate(i.dueAt)}</td>
                      <td className="bz-muted">{i.paidAt ? formatDate(i.paidAt) : '—'}</td>
                      <td><Pill tone={i.status === 'PAGA' ? 'success' : overdue ? 'danger' : 'pending'}>{overdue ? 'Vencida' : (INVOICE_STATUS[i.status]?.label || i.status)}</Pill></td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
