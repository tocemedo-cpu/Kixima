// src/pages/fornecedor/Invoices.jsx
// "Faturas geradas automaticamente por PO aceite (consulta, não emissão manual)."
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { PageHeader, Loading, ErrorBanner } from '../../components/Common';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import { INVOICE_STATUS, formatDate, formatMoney } from '../../domain';

export default function SupplierInvoices() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/api/purchase-orders').then(setOrders).catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorBanner message={error} />;
  if (!orders) return <Loading />;

  const invoiced = orders.filter((o) => o.invoice);

  return (
    <div>
      <PageHeader
        title="Faturas"
        subtitle="Geradas automaticamente quando aceita uma PO — apenas consulta."
      />

      <div className="card">
        <DataTable
          rows={invoiced}
          rowKey="id"
          onRowClick={(row) => navigate(`/fornecedor/ordens/${row.id}`)}
          emptyTitle="Sem faturas ainda"
          emptyBody="Assim que aceitar uma PO, a fatura é gerada automaticamente e aparece aqui."
          columns={[
            { key: 'invoiceRef', header: 'Fatura', render: (r) => <span className="mono">{r.invoice.reference}</span> },
            { key: 'poRef', header: 'PO', render: (r) => <span className="mono">{r.reference}</span> },
            { key: 'amount', header: 'Valor', render: (r) => formatMoney(r.invoice.amount, r.invoice.currency) },
            { key: 'due', header: 'Prazo (7 dias)', render: (r) => formatDate(r.invoice.dueAt) },
            {
              key: 'status',
              header: 'Estado',
              render: (r) => <Badge tone={INVOICE_STATUS[r.invoice.status]?.tone}>{INVOICE_STATUS[r.invoice.status]?.label}</Badge>,
            },
          ]}
        />
      </div>
    </div>
  );
}
