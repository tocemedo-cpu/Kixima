// src/pages/financeiro/PendingInvoices.jsx
// Faturas Pendentes — o Financeiro analisa e paga as faturas recebidas dentro
// do SLA. Ligado a /api/financeiro/invoices; pagamento via /api/payments.
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { Crumbs, PageHead, KpiRow, Pill, Toolbar, SupplierCell, EmptyRow } from '../../components/BuyerUI';
import { Icon } from '../../components/icons';
import { INVOICE_STATUS, formatMoney, formatDate } from '../../domain';

export default function PendingInvoices() {
  const [data, setData] = useState(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [paying, setPaying] = useState(null);

  function load() { api.get('/api/financeiro/invoices').then(setData).catch((e) => setError(e.message)); }
  useEffect(load, []);

  async function pay(inv) {
    setPaying(inv.id); setError('');
    try { await api.post(`/api/payments/invoices/${inv.id}/pay`); setToast(`Fatura ${inv.reference} paga.`); setTimeout(() => setToast(''), 3500); load(); }
    catch (e) { setError(e.message); } finally { setPaying(null); }
  }

  const k = data?.kpis;
  const now = Date.now();
  const items = (data?.items || []).filter((i) => !q || i.reference.toLowerCase().includes(q.toLowerCase()) || (i.supplier || '').toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      {toast ? <div className="svc-toast">{toast}</div> : null}
      <Crumbs trail={['Financeiro', 'Faturas Pendentes']} />
      <PageHead title="Faturas Pendentes" subtitle="Analise e pague as faturas recebidas dentro do prazo (SLA de 7 dias)." />

      <KpiRow cards={[
        { icon: 'invoice', tone: 'pending', label: 'Total Pendentes', value: k?.pendentes ?? '—', sub: k ? formatMoney(k.valorPendente) : '' },
        { icon: 'history', tone: 'info', label: 'A vencer em 7 dias', value: k?.aVencer7 ?? '—', sub: 'Prioritárias' },
        { icon: 'approvals', tone: 'danger', label: 'Vencidas', value: k?.vencidas ?? '—', sub: 'Requerem atenção' },
        { icon: 'reception', tone: 'success', label: 'Pagas (mês)', value: k?.aprovadasMes ?? '—', sub: 'Processadas' },
      ]} />

      <Toolbar placeholder="Pesquisar por nº da fatura ou fornecedor…" q={q} onQ={setQ} />
      {error ? <div className="empty-state" style={{ padding: 14 }}><p>{error}</p></div> : null}

      <div className="bz-card bz-tablewrap">
        <table className="bz-table">
          <thead><tr><th>Nº da Fatura</th><th>Fornecedor</th><th>PO</th><th className="r">Valor</th><th>Emissão</th><th>Vencimento</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {!data ? <tr><td colSpan={8}><EmptyRow>A carregar…</EmptyRow></td></tr>
              : items.length === 0 ? <tr><td colSpan={8}><EmptyRow>Sem faturas pendentes.</EmptyRow></td></tr>
              : items.map((i) => {
                const overdue = new Date(i.dueAt).getTime() < now;
                return (
                  <tr key={i.id}>
                    <td><span className="bz-mono">{i.reference}</span></td>
                    <td><SupplierCell supplier={{ name: i.supplier }} /></td>
                    <td className="bz-muted bz-mono">{i.poReference || '—'}</td>
                    <td className="r"><strong>{formatMoney(i.amount, i.currency)}</strong></td>
                    <td>{formatDate(i.issuedAt)}</td>
                    <td style={{ color: overdue ? '#c0392b' : undefined }}>{formatDate(i.dueAt)}</td>
                    <td><Pill tone={overdue ? 'danger' : 'pending'}>{overdue ? 'Vencida' : 'Pendente'}</Pill></td>
                    <td><button className="btn btn-accent btn-sm" disabled={paying === i.id} onClick={() => pay(i)}>{paying === i.id ? 'A pagar…' : 'Pagar'}</button></td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
