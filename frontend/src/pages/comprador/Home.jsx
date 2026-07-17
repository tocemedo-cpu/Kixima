// src/pages/comprador/Home.jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { PageHeader, StatCard, Loading, ErrorBanner } from '../../components/Common';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import { PO_STATUS, formatDate, formatMoney } from '../../domain';

export default function CompradorHome() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/purchase-orders').then(setOrders).catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorBanner message={error} />;
  if (!orders) return <Loading />;

  const emCurso = orders.filter((o) => !['CONCLUIDA', 'REJEITADA', 'RECUSADA_FORNECEDOR'].includes(o.status));
  const emTransito = orders.filter((o) => o.status === 'EM_EXECUCAO' || o.status === 'ENTREGUE');
  const aguardandoRececao = orders.filter((o) => o.status === 'ENTREGUE');

  return (
    <div>
      <PageHeader
        title="Visão geral"
        subtitle="Resumo das suas ordens de compra, entregas e receções pendentes."
        action={<Link className="btn btn-accent" to="/comprador/catalogo">Ir ao catálogo</Link>}
      />

      <div className="grid-cols grid-3" style={{ marginBottom: 24 }}>
        <StatCard label="POs em curso" value={emCurso.length} sub="Aguardando aprovação, aceitação ou execução" />
        <StatCard label="Entregas em trânsito" value={emTransito.length} sub="Despachadas pelo fornecedor" />
        <StatCard label="Receções pendentes" value={aguardandoRececao.length} sub="Aguardando a sua confirmação" />
      </div>

      <div className="card">
        <div className="card-pad" style={{ borderBottom: '1px solid var(--line)' }}>
          <strong>Últimas ordens de compra</strong>
        </div>
        <DataTable
          rows={orders.slice(0, 8)}
          rowKey="id"
          emptyTitle="Ainda não emitiu nenhuma PO"
          emptyBody="Vá ao catálogo, monte a sua cesta e faça o checkout."
          columns={[
            { key: 'reference', header: 'Referência', render: (r) => <span className="mono">{r.reference}</span> },
            { key: 'total', header: 'Valor', render: (r) => formatMoney(r.totalAmount, r.currency) },
            { key: 'status', header: 'Estado', render: (r) => <Badge tone={PO_STATUS[r.status]?.tone}>{PO_STATUS[r.status]?.label}</Badge> },
            { key: 'date', header: 'Emitida em', render: (r) => formatDate(r.createdAt) },
          ]}
        />
      </div>
    </div>
  );
}
