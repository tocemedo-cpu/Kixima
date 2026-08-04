// src/pages/comprador/Quotes.jsx
// Comprador → Cotações. Pede cotações a fornecedores e acompanha as respostas.
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import { PageHeader, Loading, ErrorBanner, SuccessBanner } from '../../components/Common';
import Badge from '../../components/Badge';
import { formatDate, formatMoney } from '../../domain';
import { useI18n } from '../../i18n';

const STATUS = {
  ABERTA: { label: 'Aguardando resposta', tone: 'pending' },
  RESPONDIDA: { label: 'Cotada', tone: 'success' },
  FECHADA: { label: 'Encerrada', tone: 'neutral' },
};

export default function Quotes() {
  const { t } = useI18n();
  const [catalog, setCatalog] = useState(null);
  const [quotes, setQuotes] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [lines, setLines] = useState([{ productId: '', quantity: 1 }]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  function loadQuotes() { api.get('/api/quotes').then(setQuotes).catch((e) => setError(e.message)); }
  useEffect(() => {
    api.get('/api/catalog').then(setCatalog).catch((e) => setError(e.message));
    loadQuotes();
  }, []);

  const byId = useMemo(() => new Map((catalog || []).map((p) => [p.id, p])), [catalog]);
  const setLine = (i, k, v) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)));

  // Fornecedor derivado dos itens escolhidos (todos têm de ser do mesmo).
  const chosen = lines.filter((l) => l.productId).map((l) => byId.get(l.productId)).filter(Boolean);
  const supplierIds = [...new Set(chosen.map((p) => p.supplier?.id))];
  const sameSupplier = supplierIds.length <= 1;

  function resetForm() { setLines([{ productId: '', quantity: 1 }]); setNote(''); }

  async function submit(e) {
    e.preventDefault();
    setError(''); setSuccess('');
    const items = lines.filter((l) => l.productId).map((l) => ({ productId: l.productId, quantity: Number(l.quantity) || 1 }));
    if (items.length === 0) return setError('Adicione pelo menos um produto.');
    if (!sameSupplier) return setError('Todos os produtos do pedido devem ser do mesmo fornecedor.');
    const supplierCompanyId = supplierIds[0];
    setSaving(true);
    try {
      await api.post('/api/quotes', { supplierCompanyId, items, note: note || undefined });
      setSuccess('Pedido de cotação enviado.');
      resetForm(); setShowForm(false); loadQuotes();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  async function close(id) {
    try { await api.patch(`/api/quotes/${id}/close`); loadQuotes(); } catch (e) { setError(e.message); }
  }

  if (!catalog || !quotes) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Cotações"
        subtitle="Peça preços a fornecedores antes de emitir a ordem de compra."
        action={<button className="btn btn-accent" onClick={() => { setShowForm((v) => !v); if (showForm) resetForm(); }}>{showForm ? 'Cancelar' : '+ Pedir cotação'}</button>}
      />
      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      {showForm && (
        <div className="card card-pad" style={{ marginBottom: 18, maxWidth: 620 }}>
          <form onSubmit={submit}>
            <div className="reg-section" style={{ marginTop: 0 }}>Produtos (do mesmo fornecedor)</div>
            {lines.map((l, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 8 }}>
                <div className="field" style={{ margin: 0, flex: 1 }}>
                  <label>Produto</label>
                  <select value={l.productId} onChange={(e) => setLine(i, 'productId', e.target.value)}>
                    <option value="">— escolher —</option>
                    {catalog.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.supplier?.name}</option>)}
                  </select>
                </div>
                <div className="field" style={{ margin: 0, width: 90 }}><label>Qtd.</label><input type="number" min="1" value={l.quantity} onChange={(e) => setLine(i, 'quantity', e.target.value)} /></div>
                {lines.length > 1 ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}>×</button> : null}
              </div>
            ))}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLines((ls) => [...ls, { productId: '', quantity: 1 }])} style={{ marginBottom: 12 }}>+ Adicionar produto</button>
            {!sameSupplier ? <p className="error-text" style={{ margin: '0 0 10px' }}>Os produtos escolhidos são de fornecedores diferentes.</p> : null}
            <div className="field"><label>Nota (opcional)</label><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
            <button className="btn btn-accent" type="submit" disabled={saving}>{saving ? 'A enviar…' : 'Enviar pedido'}</button>
          </form>
        </div>
      )}

      {quotes.length === 0 ? (
        <div className="empty-state"><h3>{t('Sem cotações')}</h3><p>Peça uma cotação para começar.</p></div>
      ) : (
        quotes.map((q) => (
          <div key={q.id} className="card card-pad" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <strong>{q.supplierCompany?.name || 'Fornecedor'}</strong>
                <div style={{ fontSize: 12.5, color: 'var(--ink-600)' }}>{formatDate(q.createdAt)}</div>
              </div>
              <Badge tone={STATUS[q.status]?.tone}>{STATUS[q.status]?.label}</Badge>
            </div>
            <ul style={{ margin: '10px 0', paddingLeft: 18, fontSize: 13.5 }}>
              {q.items.map((it) => <li key={it.id}>{it.quantity}× {it.product?.name || '—'}</li>)}
            </ul>
            {q.status !== 'ABERTA' && q.responsePrice != null ? (
              <div style={{ fontSize: 13.5, background: 'var(--paper-050)', borderRadius: 8, padding: '10px 12px' }}>
                Cotação: <strong>{formatMoney(q.responsePrice, q.items[0]?.product?.currency || 'AOA')}</strong>
                {q.responseLeadDays != null ? ` · prazo ${q.responseLeadDays} dias` : ''}
                {q.responseNote ? ` · ${q.responseNote}` : ''}
              </div>
            ) : null}
            {q.status === 'RESPONDIDA' ? (
              <div style={{ marginTop: 10 }}><button className="btn btn-ghost btn-sm" onClick={() => close(q.id)}>Encerrar</button></div>
            ) : null}
          </div>
        ))
      )}
    </div>
  );
}
