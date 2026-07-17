// src/pages/financeiro/Home.jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { PageHeader, StatCard, Loading, ErrorBanner } from '../../components/Common';
import DataTable from '../../components/DataTable';
import { formatDate, formatMoney } from '../../domain';

export default function FinanceiroHome() {
  const [invoices, setInvoices] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/payments/invoices/pending').then(setInvoices).catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorBanner message={error} />;
  if (!invoices) return <Loading />;

  const totalToPay = invoices.reduce((sum, i) => sum + Number(i.amount), 0);
  const currency = invoices[0]?.currency || 'AOA';
  const now = new Date();
  const vencendoEm3Dias = invoices.filter((i) => (new Date(i.dueAt) - now) / (1000 * 60 * 60 * 24) <= 3);

  return (
    <div>
      <PageHeader
        title="Visão geral"
        subtitle="Faturas pendentes de pagamento, valor total a pagar e prazos a vencer."
        action={<Link className="btn btn-accent" to="/financeiro/faturas">Processar pagamentos</Link>}
      />

      <div className="grid-cols grid-3" style={{ marginBottom: 24 }}>
        <StatCard label="Faturas pendentes" value={invoices.length} />
        <StatCard label="Valor total a pagar" value={formatMoney(totalToPay, currency)} />
        <StatCard label="A vencer em ≤ 3 dias" value={vencendoEm3Dias.length} sub="Dentro da garantia dos 7 dias" />
      </div>

      <div className="card">
        <div className="card-pad" style={{ borderBottom: '1px solid var(--line)' }}>
          <strong>Faturas mais urgentes</strong>
        </div>
        <DataTable
          rows={[...invoices].sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt)).slice(0, 8)}
          rowKey="id"
          emptyTitle="Sem faturas pendentes"
          emptyBody="Quando um fornecedor aceitar uma PO, a fatura aparece aqui."
          columns={[
            { key: 'reference', header: 'Fatura', render: (r) => <span className="mono">{r.reference}</span> },
            { key: 'amount', header: 'Valor', render: (r) => formatMoney(r.amount, r.currency) },
            { key: 'due', header: 'Prazo', render: (r) => formatDate(r.dueAt) },
          ]}
        />
      </div>
    </div>
  );
}
