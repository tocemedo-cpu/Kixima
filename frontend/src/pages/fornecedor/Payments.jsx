// src/pages/fornecedor/Payments.jsx
// Pagamentos Recebidos (Fornecedor): mostra o COMPROVATIVO da transferência
// anexado pelo Financeiro do cliente e permite CONFIRMAR A RECEÇÃO do valor —
// fecha o ciclo de confiança do pagamento garantido.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { PageHeader, Loading, ErrorBanner } from '../../components/Common';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import { formatDate, formatDateTime, formatMoney } from '../../domain';

export default function SupplierPayments() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [confirming, setConfirming] = useState(null);
  const navigate = useNavigate();

  function load() { api.get('/api/purchase-orders').then(setOrders).catch((e) => setError(e.message)); }
  useEffect(load, []);

  async function confirmReceived(payment) {
    setConfirming(payment.id); setError('');
    try {
      await api.patch(`/api/payments/${payment.id}/confirm-received`);
      setToast('Receção do valor confirmada. Obrigado!');
      setTimeout(() => setToast(''), 3500);
      load();
    } catch (e) { setError(e.message); } finally { setConfirming(null); }
  }

  if (error && !orders) return <ErrorBanner message={error} />;
  if (!orders) return <Loading />;

  const paid = orders.filter((o) => o.invoice?.payment);

  return (
    <div>
      {toast ? <div className="svc-toast">{toast}</div> : null}
      <PageHeader title="Pagamentos Recebidos" subtitle="Comprovativos anexados pelo cliente — confirme quando o valor entrar na sua conta." />
      <ErrorBanner message={error} />

      <div className="card">
        <DataTable
          rows={paid}
          rowKey="id"
          onRowClick={(row) => navigate(`/fornecedor/ordens/${row.id}`)}
          emptyTitle="Sem pagamentos recebidos ainda"
          emptyBody="Quando o Financeiro do cliente processar um pagamento, ele aparece aqui."
          columns={[
            { key: 'paymentRef', header: 'Pagamento', render: (r) => <span className="mono">{r.invoice.payment.reference}</span> },
            { key: 'poRef', header: 'PO', render: (r) => <span className="mono">{r.reference}</span> },
            { key: 'amount', header: 'Valor', render: (r) => formatMoney(r.invoice.payment.amount, r.invoice.payment.currency) },
            { key: 'processedAt', header: 'Processado em', render: (r) => formatDateTime(r.invoice.payment.processedAt) },
            {
              key: 'proof',
              header: 'Comprovativo',
              render: (r) => r.invoice.payment.proofUrl ? (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={(e) => { e.stopPropagation(); window.open(r.invoice.payment.proofUrl, '_blank'); }}
                  title={r.invoice.payment.proofName || 'comprovativo'}
                >
                  Ver comprovativo
                </button>
              ) : <span className="bz-muted">—</span>,
            },
            {
              key: 'reception',
              header: 'Receção do valor',
              render: (r) => {
                const p = r.invoice.payment;
                if (p.receivedAt) return <Badge tone="success">Confirmada · {formatDate(p.receivedAt)}</Badge>;
                return (
                  <button
                    className="btn btn-accent btn-sm"
                    disabled={confirming === p.id}
                    onClick={(e) => { e.stopPropagation(); confirmReceived(p); }}
                  >
                    {confirming === p.id ? 'A confirmar…' : 'Confirmar receção'}
                  </button>
                );
              },
            },
          ]}
        />
      </div>
    </div>
  );
}
