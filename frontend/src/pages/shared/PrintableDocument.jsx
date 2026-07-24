// src/pages/shared/PrintableDocument.jsx
// Documento imprimível/descarregável da Ordem de Compra ou da Fatura. Renderiza
// uma folha A4 limpa; o botão "Imprimir / Guardar PDF" abre o diálogo do
// browser (que permite imprimir OU guardar como PDF). O CSS de impressão esconde
// a barra de ações e deixa só o documento.
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { Loading, ErrorBanner } from '../../components/Common';
import Logo from '../../components/Logo';
import { PO_STATUS, INVOICE_STATUS, formatDate, formatDateTime, formatMoney } from '../../domain';

export default function PrintableDocument({ kind }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [po, setPo] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/api/purchase-orders/${id}`).then(setPo).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <div style={{ padding: 24 }}><ErrorBanner message={error} /></div>;
  if (!po) return <Loading />;

  const isInvoice = kind === 'invoice';
  const invoice = po.invoice;
  if (isInvoice && !invoice) {
    return (
      <div className="doc-page">
        <div className="doc-toolbar no-print">
          <button className="btn btn-ghost" onClick={() => navigate(-1)}>← Voltar</button>
        </div>
        <div className="doc-sheet"><p>Esta ordem ainda não tem fatura emitida.</p></div>
      </div>
    );
  }

  const supplier = po.supplierCompany || {};
  const buyer = po.buyerCompany || {};
  const currency = po.currency || 'AOA';

  return (
    <div className="doc-page">
      <div className="doc-toolbar no-print">
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>← Voltar</button>
        <button className="btn btn-accent" onClick={() => window.print()}>Imprimir / Guardar PDF</button>
      </div>

      <div className="doc-sheet">
        <header className="doc-head">
          <Logo size={22} mark={54} />
          <div className="doc-title">
            <h1>{isInvoice ? 'FATURA' : 'ORDEM DE COMPRA'}</h1>
            <div className="doc-ref">{isInvoice ? invoice.reference : po.reference}</div>
          </div>
        </header>

        <section className="doc-parties">
          <div>
            <div className="doc-label">{isInvoice ? 'Emitido por' : 'Fornecedor'}</div>
            <strong>{supplier.name || '—'}</strong>
            {supplier.taxId ? <div>NIF: {supplier.taxId}</div> : null}
            {supplier.contactEmail ? <div>{supplier.contactEmail}</div> : null}
            {supplier.address ? <div>{supplier.address}</div> : null}
          </div>
          <div>
            <div className="doc-label">{isInvoice ? 'Faturado a' : 'Comprador'}</div>
            <strong>{buyer.name || '—'}</strong>
            {buyer.taxId ? <div>NIF: {buyer.taxId}</div> : null}
            {buyer.contactEmail ? <div>{buyer.contactEmail}</div> : null}
            {buyer.address ? <div>{buyer.address}</div> : null}
          </div>
        </section>

        <section className="doc-meta">
          {isInvoice ? (
            <>
              <Meta label="Nº da fatura" value={invoice.reference} />
              <Meta label="Ordem de compra" value={po.reference} />
              <Meta label="Data de emissão" value={formatDate(invoice.issuedAt)} />
              <Meta label="Vencimento" value={formatDate(invoice.dueAt)} />
              <Meta label="Estado" value={INVOICE_STATUS[invoice.status]?.label || invoice.status} />
            </>
          ) : (
            <>
              <Meta label="Referência" value={po.reference} />
              <Meta label="Data de emissão" value={formatDate(po.createdAt)} />
              <Meta label="Estado" value={PO_STATUS[po.status]?.label || po.status} />
              {po.isCallOff ? <Meta label="Tipo" value="Call-off (contrato-quadro)" /> : null}
            </>
          )}
        </section>

        <table className="doc-table">
          <thead>
            <tr><th>#</th><th>Descrição</th><th className="r">Qtd.</th><th className="r">Preço unit.</th><th className="r">Total</th></tr>
          </thead>
          <tbody>
            {po.items.map((it, i) => (
              <tr key={it.id}>
                <td>{i + 1}</td>
                <td>{it.product?.name || it.productId}</td>
                <td className="r">{it.quantity}</td>
                <td className="r">{formatMoney(it.unitPrice, currency)}</td>
                <td className="r">{formatMoney(it.lineTotal, currency)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={4} className="r"><strong>Total</strong></td><td className="r"><strong>{formatMoney(isInvoice ? invoice.amount : po.totalAmount, currency)}</strong></td></tr>
          </tfoot>
        </table>

        {isInvoice && invoice.payment ? (
          <section className="doc-paid">
            Pago em {formatDateTime(invoice.payment.processedAt)} — referência {invoice.payment.reference}.
          </section>
        ) : null}

        <footer className="doc-foot">
          <div>KIXIMA — Plataforma de Procurement Garantido</div>
          <div>Documento gerado em {formatDateTime(new Date().toISOString())}</div>
        </footer>
      </div>
    </div>
  );
}

function Meta({ label, value }) {
  return (
    <div className="doc-meta-item">
      <div className="doc-label">{label}</div>
      <div>{value}</div>
    </div>
  );
}
