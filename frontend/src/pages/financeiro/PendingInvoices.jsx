// src/pages/financeiro/PendingInvoices.jsx
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { PageHeader, Loading, ErrorBanner, SuccessBanner } from '../../components/Common';
import PaymentSlaRing from '../../components/PaymentSlaRing';
import { formatDate, formatMoney } from '../../domain';

export default function PendingInvoices() {
  const [invoices, setInvoices] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [payingId, setPayingId] = useState(null);

  function load() {
    api.get('/api/payments/invoices/pending').then(setInvoices).catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function pay(invoice) {
    setError('');
    setSuccess('');
    setPayingId(invoice.id);
    try {
      await api.post(`/api/payments/invoices/${invoice.id}/pay`);
      setSuccess(`Pagamento da fatura ${invoice.reference} processado com sucesso.`);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setPayingId(null);
    }
  }

  if (error && !invoices) return <ErrorBanner message={error} />;
  if (!invoices) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Faturas Pendentes"
        subtitle="Faturas geradas automaticamente na aceitação da PO — pague dentro dos 7 dias. Executa, não decide."
      />
      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      {invoices.length === 0 ? (
        <div className="empty-state">
          <h3>Sem faturas pendentes</h3>
          <p>Todas as faturas geradas foram pagas.</p>
        </div>
      ) : (
        invoices.map((invoice) => {
          const po = invoice.purchaseOrder;
          const contract = invoice.contract;
          return (
            <div key={invoice.id} className="card card-pad" style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <div>
                <div className="mono" style={{ fontWeight: 600, fontSize: 14 }}>{invoice.reference}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-600)', marginTop: 3 }}>
                  {po ? `PO ${po.reference}` : `Faturação consolidada — contrato ${contract?.reference}`}
                </div>
                <div style={{ fontSize: 13, marginTop: 6 }}>{formatMoney(invoice.amount, invoice.currency)}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-400)', marginTop: 2 }}>Prazo: {formatDate(invoice.dueAt)}</div>
              </div>

              {po ? <PaymentSlaRing acceptedAt={po.acceptedAt} paymentDueAt={po.paymentDueAt} paidAt={po.paidAt} /> : null}

              <button className="btn btn-accent" disabled={payingId === invoice.id} onClick={() => pay(invoice)}>
                {payingId === invoice.id ? 'A processar…' : 'Processar pagamento'}
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}
