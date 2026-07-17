// src/pages/companyAdmin/Contracts.jsx
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { PageHeader, Loading, ErrorBanner } from '../../components/Common';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import { formatDate, formatMoney } from '../../domain';

const CONTRACT_STATUS = {
  ATIVO: { label: 'Ativo', tone: 'success' },
  EXPIRADO: { label: 'Expirado', tone: 'danger' },
  ENCERRADO: { label: 'Encerrado', tone: 'neutral' },
};

export default function Contracts() {
  const [contracts, setContracts] = useState(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    api.get('/api/contracts').then(setContracts).catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorBanner message={error} />;
  if (!contracts) return <Loading />;

  return (
    <div>
      <PageHeader title="Contratos" subtitle="Contratos-quadro ativos com fornecedores e as respetivas call-offs." />

      <div className="card">
        <DataTable
          rows={contracts}
          rowKey="id"
          onRowClick={(row) => setExpanded(expanded === row.id ? null : row.id)}
          emptyTitle="Sem contratos-quadro"
          emptyBody="Contratos-quadro são criados pelo Admin do Sistema KIXIMA ou pelo Company Admin."
          columns={[
            { key: 'reference', header: 'Referência', render: (r) => <span className="mono">{r.reference}</span> },
            { key: 'value', header: 'Valor / Saldo usado', render: (r) => `${formatMoney(r.usedValue, r.currency)} / ${formatMoney(r.totalValue, r.currency)}` },
            { key: 'periodicity', header: 'Periodicidade', render: (r) => (r.billingPeriodicity === 'TRIMESTRAL' ? 'Trimestral' : 'Semestral') },
            { key: 'validity', header: 'Vigência', render: (r) => `${formatDate(r.validFrom)} — ${formatDate(r.validUntil)}` },
            { key: 'status', header: 'Estado', render: (r) => <Badge tone={CONTRACT_STATUS[r.status]?.tone}>{CONTRACT_STATUS[r.status]?.label}</Badge> },
          ]}
        />
      </div>

      {expanded && (
        <ContractCallOffs contractId={expanded} />
      )}
    </div>
  );
}

function ContractCallOffs({ contractId }) {
  const [contract, setContract] = useState(null);

  useEffect(() => {
    api.get(`/api/contracts/${contractId}`).then(setContract).catch(() => {});
  }, [contractId]);

  if (!contract) return null;

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-pad" style={{ borderBottom: '1px solid var(--line)' }}>
        <strong>Call-offs do contrato {contract.reference}</strong>
      </div>
      <DataTable
        rows={contract.callOffs}
        rowKey="id"
        emptyTitle="Sem call-offs ainda"
        emptyBody="Cada PO emitida ao abrigo deste contrato aparece aqui automaticamente."
        columns={[
          { key: 'reference', header: 'PO', render: (r) => <span className="mono">{r.reference}</span> },
          { key: 'total', header: 'Valor', render: (r) => formatMoney(r.totalAmount, r.currency) },
          { key: 'status', header: 'Estado', render: (r) => r.status },
          { key: 'invoice', header: 'Faturação', render: (r) => (r.paidAt ? <Badge tone="success">Faturado</Badge> : <Badge tone="pending">Por faturar</Badge>) },
        ]}
      />
    </div>
  );
}
