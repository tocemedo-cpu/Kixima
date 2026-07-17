// src/pages/companyAdmin/Approvals.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { PageHeader, Loading, ErrorBanner } from '../../components/Common';
import DataTable from '../../components/DataTable';
import { formatDate, formatMoney } from '../../domain';

export default function Approvals() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/api/purchase-orders', { status: 'AGUARDANDO_APROVACAO' }).then(setOrders).catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorBanner message={error} />;
  if (!orders) return <Loading />;

  return (
    <div>
      <PageHeader title="Aprovações de PO" subtitle="Ponto único de aprovação — reveja e aprove ou rejeite cada ordem de compra." />
      <div className="card">
        <DataTable
          rows={orders}
          rowKey="id"
          onRowClick={(row) => navigate(`/empresa/aprovacoes/${row.id}`)}
          emptyTitle="Nenhuma PO à espera de aprovação"
          emptyBody="Assim que um comprador emitir uma PO, ela aparece aqui."
          columns={[
            { key: 'reference', header: 'Referência', render: (r) => <span className="mono">{r.reference}</span> },
            { key: 'total', header: 'Valor', render: (r) => formatMoney(r.totalAmount, r.currency) },
            { key: 'date', header: 'Emitida em', render: (r) => formatDate(r.createdAt) },
            { key: 'action', header: '', render: () => <span style={{ color: 'var(--brand-600)', fontWeight: 600 }}>Rever →</span> },
          ]}
        />
      </div>
    </div>
  );
}
