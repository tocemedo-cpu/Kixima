// src/pages/financeiro/PaymentHistory.jsx
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { PageHeader, Loading, ErrorBanner } from '../../components/Common';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import { formatDateTime, formatMoney } from '../../domain';

export default function PaymentHistory() {
  const [payments, setPayments] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/payments/history').then(setPayments).catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorBanner message={error} />;
  if (!payments) return <Loading />;

  return (
    <div>
      <PageHeader title="Histórico de Pagamentos" subtitle="Pagamentos já processados pela sua empresa." />

      <div className="card">
        <DataTable
          rows={payments}
          rowKey="id"
          emptyTitle="Sem pagamentos processados ainda"
          emptyBody="Os pagamentos que processar aparecem aqui."
          columns={[
            { key: 'reference', header: 'Pagamento', render: (r) => <span className="mono">{r.reference}</span> },
            {
              key: 'target',
              header: 'Referência',
              render: (r) => (
                <span className="mono">
                  {r.invoice.purchaseOrder ? r.invoice.purchaseOrder.reference : `Contrato ${r.invoice.contract?.reference}`}
                </span>
              ),
            },
            { key: 'amount', header: 'Valor', render: (r) => formatMoney(r.amount, r.currency) },
            { key: 'processedAt', header: 'Processado em', render: (r) => formatDateTime(r.processedAt) },
            { key: 'status', header: 'Estado', render: () => <Badge tone="success">Processado</Badge> },
          ]}
        />
      </div>
    </div>
  );
}
