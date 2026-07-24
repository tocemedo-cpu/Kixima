// src/pages/fornecedor/Wallet.jsx
// Financeiro → Carteira. Resumo financeiro do fornecedor: já recebido, a receber
// e em execução, a partir das ordens recebidas.
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { PageHeader, Loading, ErrorBanner, StatCard } from '../../components/Common';
import Badge from '../../components/Badge';
import { PO_STATUS, formatDate, formatMoney } from '../../domain';

const RECEIVED = new Set(['PAGA', 'EM_EXECUCAO', 'ENTREGUE', 'RECEBIDA_CONFORME', 'RECEBIDA_COM_DIVERGENCIA', 'CONCLUIDA']);
const PENDING = new Set(['ACEITE_FORNECEDOR', 'AGUARDANDO_PAGAMENTO']);

export default function Wallet() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/purchase-orders').then(setOrders).catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorBanner message={error} />;
  if (!orders) return <Loading />;

  const sum = (set) => orders.filter((o) => set.has(o.status)).reduce((s, o) => s + Number(o.totalAmount), 0);
  const received = sum(RECEIVED);
  const pending = sum(PENDING);
  const recentPaid = orders
    .filter((o) => o.invoice?.payment)
    .sort((a, b) => new Date(b.invoice.payment.paidAt || b.createdAt) - new Date(a.invoice.payment.paidAt || a.createdAt))
    .slice(0, 8);

  return (
    <div>
      <PageHeader title="Financeiro — Carteira" subtitle="A sua posição financeira na plataforma." />

      <div className="grid-cols grid-3" style={{ marginBottom: 18 }}>
        <StatCard label="Já recebido" value={formatMoney(received)} sub="Ordens pagas ou em execução" />
        <StatCard label="A receber" value={formatMoney(pending)} sub="Aceites, a aguardar pagamento" />
        <StatCard label="Saldo movimentado" value={formatMoney(received + pending)} />
      </div>

      <div className="card">
        <div className="card-pad" style={{ borderBottom: '1px solid var(--line)' }}><strong>Últimos recebimentos</strong></div>
        {recentPaid.length === 0 ? (
          <div className="card-pad"><p className="helptext" style={{ margin: 0 }}>Ainda sem pagamentos recebidos.</p></div>
        ) : (
          <table>
            <thead><tr><th>Referência</th><th>Cliente</th><th>Estado</th><th style={{ textAlign: 'right' }}>Valor</th></tr></thead>
            <tbody>
              {recentPaid.map((o) => (
                <tr key={o.id}>
                  <td className="mono">{o.reference}</td>
                  <td>{o.buyerCompany?.name || '—'}</td>
                  <td><Badge tone={PO_STATUS[o.status]?.tone}>{PO_STATUS[o.status]?.label || o.status}</Badge></td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatMoney(o.totalAmount, o.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
