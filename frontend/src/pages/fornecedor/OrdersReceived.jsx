// src/pages/fornecedor/OrdersReceived.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { PageHeader, Loading, ErrorBanner } from '../../components/Common';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import { PO_STATUS, formatDate, formatMoney } from '../../domain';

export default function OrdersReceived() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/api/purchase-orders', { status: statusFilter || undefined }).then(setOrders).catch((e) => setError(e.message));
  }, [statusFilter]);

  return (
    <div>
      <PageHeader
        title="Ordens de Compra Recebidas"
        subtitle="Aceite ou recuse novas POs; acompanhe o estado até à entrega."
      />
      <ErrorBanner message={error} />

      <div className="field" style={{ maxWidth: 260, marginBottom: 16 }}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Todos os estados</option>
          {Object.entries(PO_STATUS).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
      </div>

      {!orders ? (
        <Loading />
      ) : (
        <div className="card">
          <DataTable
            rows={orders}
            rowKey="id"
            onRowClick={(row) => navigate(`/fornecedor/ordens/${row.id}`)}
            emptyTitle="Sem ordens de compra recebidas"
            emptyBody="Quando um cliente emitir uma PO para a sua empresa, ela aparece aqui."
            columns={[
              { key: 'reference', header: 'Referência', render: (r) => <span className="mono">{r.reference}</span> },
              { key: 'total', header: 'Valor', render: (r) => formatMoney(r.totalAmount, r.currency) },
              { key: 'callOff', header: 'Tipo', render: (r) => (r.isCallOff ? <Badge tone="info">Call-off</Badge> : 'PO regular') },
              { key: 'status', header: 'Estado', render: (r) => <Badge tone={PO_STATUS[r.status]?.tone}>{PO_STATUS[r.status]?.label}</Badge> },
              { key: 'date', header: 'Recebida em', render: (r) => formatDate(r.createdAt) },
            ]}
          />
        </div>
      )}
    </div>
  );
}
