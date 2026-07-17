// src/pages/fornecedor/Payments.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { PageHeader, Loading, ErrorBanner } from '../../components/Common';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import { formatDateTime, formatMoney } from '../../domain';

export default function SupplierPayments() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/api/purchase-orders').then(setOrders).catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorBanner message={error} />;
  if (!orders) return <Loading />;

  const paid = orders.filter((o) => o.invoice?.payment);

  return (
    <div>
      <PageHeader title="Pagamentos Recebidos" subtitle="Histórico de pagamentos processados pelo Financeiro do cliente." />

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
            { key: 'status', header: 'Estado', render: () => <Badge tone="success">Processado</Badge> },
          ]}
        />
      </div>
    </div>
  );
}
