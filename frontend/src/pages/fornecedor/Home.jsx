// src/pages/fornecedor/Home.jsx
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { PageHeader, StatCard, Loading, ErrorBanner } from '../../components/Common';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import { PO_STATUS, formatDate, formatMoney } from '../../domain';
import { useNavigate } from 'react-router-dom';

export default function FornecedorHome() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/api/purchase-orders').then(setOrders).catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorBanner message={error} />;
  if (!orders) return <Loading />;

  const novas = orders.filter((o) => o.status === 'APROVADA');
  const aguardandoPagamento = orders.filter((o) => o.status === 'ACEITE_FORNECEDOR');
  const pagas = orders.filter((o) => o.paidAt);

  return (
    <div>
      <PageHeader title="Central de Negócios" subtitle="Resumo: POs novas, faturas pendentes, pagamentos recebidos." />

      <div className="grid-cols grid-3" style={{ marginBottom: 24 }}>
        <StatCard label="POs novas para aceitar" value={novas.length} />
        <StatCard label="Aguardando pagamento" value={aguardandoPagamento.length} sub="Dentro do prazo garantido de 7 dias" />
        <StatCard label="Pagamentos recebidos" value={pagas.length} />
      </div>

      <div className="card">
        <div className="card-pad" style={{ borderBottom: '1px solid var(--line)' }}>
          <strong>Ordens de compra recentes</strong>
        </div>
        <DataTable
          rows={orders.slice(0, 8)}
          rowKey="id"
          onRowClick={(row) => navigate(`/fornecedor/ordens/${row.id}`)}
          emptyTitle="Sem ordens de compra ainda"
          emptyBody="Assim que um cliente emitir uma PO para a sua empresa, ela aparece aqui."
          columns={[
            { key: 'reference', header: 'Referência', render: (r) => <span className="mono">{r.reference}</span> },
            { key: 'total', header: 'Valor', render: (r) => formatMoney(r.totalAmount, r.currency) },
            { key: 'status', header: 'Estado', render: (r) => <Badge tone={PO_STATUS[r.status]?.tone}>{PO_STATUS[r.status]?.label}</Badge> },
            { key: 'date', header: 'Recebida em', render: (r) => formatDate(r.createdAt) },
          ]}
        />
      </div>
    </div>
  );
}
