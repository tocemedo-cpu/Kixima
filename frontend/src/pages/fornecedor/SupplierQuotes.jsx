// src/pages/fornecedor/SupplierQuotes.jsx
// Pedidos → Solicitações (RFQ por responder) e Cotações (já respondidas).
// Route-aware: /solicitacoes mostra ABERTA com formulário de resposta;
// /cotacoes mostra as respondidas/encerradas.
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../../api/client';
import { PageHeader, Loading, ErrorBanner, SuccessBanner } from '../../components/Common';
import Badge from '../../components/Badge';
import { formatDate, formatMoney } from '../../domain';
import { useI18n } from '../../i18n';

const STATUS = {
  ABERTA: { label: 'Aberta', tone: 'pending' },
  RESPONDIDA: { label: 'Respondida', tone: 'info' },
  FECHADA: { label: 'Encerrada', tone: 'neutral' },
};

export default function SupplierQuotes() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const isInbox = pathname.endsWith('/solicitacoes');
  const [quotes, setQuotes] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function load() {
    api.get('/api/quotes').then(setQuotes).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  if (!quotes) return <Loading />;
  const list = quotes.filter((q) => (isInbox ? q.status === 'ABERTA' : q.status !== 'ABERTA'));

  return (
    <div>
      <PageHeader
        title={isInbox ? 'Pedidos — Solicitações' : 'Pedidos — Cotações'}
        subtitle={isInbox ? 'Pedidos de cotação recebidos que aguardam a sua resposta.' : 'Cotações que já respondeu.'}
      />
      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      {list.length === 0 ? (
        <div className="empty-state"><h3>{t('Nada por aqui')}</h3><p>{isInbox ? 'Sem solicitações por responder.' : 'Ainda não respondeu a cotações.'}</p></div>
      ) : (
        list.map((q) => (
          <QuoteCard key={q.id} quote={q} respondable={isInbox} onDone={(msg) => { setSuccess(msg); load(); }} onError={setError} />
        ))
      )}
    </div>
  );
}

function QuoteCard({ quote, respondable, onDone, onError }) {
  const [price, setPrice] = useState('');
  const [leadDays, setLeadDays] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function respond(e) {
    e.preventDefault();
    onError('');
    if (!price || Number(price) <= 0) return onError('Indique um preço válido.');
    setSaving(true);
    try {
      await api.patch(`/api/quotes/${quote.id}/respond`, { price: Number(price), leadDays: leadDays ? Number(leadDays) : undefined, note: note || undefined });
      onDone('Cotação enviada ao comprador.');
    } catch (err) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card card-pad" style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div>
          <strong>{quote.buyerCompany?.name || 'Comprador'}</strong>
          <div style={{ fontSize: 12.5, color: 'var(--ink-600)' }}>{formatDate(quote.createdAt)}</div>
        </div>
        <Badge tone={STATUS[quote.status]?.tone}>{STATUS[quote.status]?.label}</Badge>
      </div>

      <ul style={{ margin: '10px 0', paddingLeft: 18, fontSize: 13.5 }}>
        {quote.items.map((it) => <li key={it.id}>{it.quantity}× {it.product?.name || '—'}</li>)}
      </ul>
      {quote.note ? <p className="helptext" style={{ marginTop: 0 }}>Nota do comprador: {quote.note}</p> : null}

      {quote.status !== 'ABERTA' && quote.responsePrice != null ? (
        <div style={{ fontSize: 13.5, marginTop: 6 }}>
          A sua cotação: <strong>{formatMoney(quote.responsePrice, quote.items[0]?.product?.currency || 'AOA')}</strong>
          {quote.responseLeadDays != null ? ` · prazo ${quote.responseLeadDays} dias` : ''}
          {quote.responseNote ? ` · ${quote.responseNote}` : ''}
        </div>
      ) : null}

      {respondable && (
        <form onSubmit={respond} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          <div className="field" style={{ margin: 0, width: 160 }}><label>Preço proposto</label><input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
          <div className="field" style={{ margin: 0, width: 120 }}><label>Prazo (dias)</label><input type="number" min="0" value={leadDays} onChange={(e) => setLeadDays(e.target.value)} /></div>
          <div className="field" style={{ margin: 0, flex: '1 1 160px' }}><label>Nota (opcional)</label><input value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <button className="btn btn-accent" type="submit" disabled={saving}>{saving ? 'A enviar…' : 'Enviar cotação'}</button>
        </form>
      )}
    </div>
  );
}
