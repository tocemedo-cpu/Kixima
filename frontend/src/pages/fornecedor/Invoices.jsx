// src/pages/fornecedor/Invoices.jsx
// "Faturas geradas automaticamente por PO aceite (consulta, não emissão manual)."
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { PageHeader, Loading, ErrorBanner } from '../../components/Common';
import DataTable from '../../components/DataTable';
import { Pagination } from '../../components/BuyerUI';
import Badge from '../../components/Badge';
import { INVOICE_STATUS, formatDate, formatMoney } from '../../domain';

export default function SupplierInvoices() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    setError('');
    // Paginação server-side: só ordens já faturadas.
    api.get('/api/purchase-orders', { invoiced: 'true', page, limit: 15 })
      .then(setData).catch((e) => setError(e.message));
  }, [page]);

  if (error) return <ErrorBanner message={error} />;
  if (!data) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Faturas"
        subtitle="Geradas automaticamente quando aceita uma PO — apenas consulta."
      />

      <div className="card">
        <DataTable
          rows={data.items}
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
        <div style={{ padding: '10px 14px' }}>
          <Pagination page={data.page} pages={data.pages} total={data.total} onPage={setPage} unit="faturas" />
        </div>
      </div>
    </div>
  );
}
