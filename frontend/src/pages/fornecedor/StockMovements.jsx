// src/pages/fornecedor/StockMovements.jsx
// Inventário → Entradas / Saídas. Regista movimentos de inventário (que ajustam
// o stock do produto) e lista o histórico do tipo correspondente à rota.
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../api/client';
import { PageHeader, Loading, ErrorBanner, SuccessBanner } from '../../components/Common';
import { formatDateTime } from '../../domain';

export default function StockMovements() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const isEntrada = pathname.endsWith('/entradas');
  const type = isEntrada ? 'ENTRADA' : 'SAIDA';
  const title = isEntrada ? 'Entradas' : 'Saídas';

  const [products, setProducts] = useState(null);
  const [movements, setMovements] = useState(null);
  const [form, setForm] = useState({ productId: '', quantity: '', note: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  function loadMovements() {
    api.get('/api/catalog/movements', { type }).then(setMovements).catch((e) => setError(e.message));
  }
  useEffect(() => {
    api.get('/api/catalog', { supplierId: user.companyId }).then(setProducts).catch((e) => setError(e.message));
  }, [user.companyId]);
  useEffect(loadMovements, [type]);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!form.productId) return setError('Escolha o produto.');
    if (!form.quantity || Number(form.quantity) <= 0) return setError('Indique uma quantidade válida.');
    setSaving(true);
    try {
      await api.post('/api/catalog/movements', { productId: form.productId, type, quantity: Number(form.quantity), note: form.note || undefined });
      setSuccess(`${title === 'Entradas' ? 'Entrada' : 'Saída'} registada. O stock foi atualizado.`);
      setForm({ productId: '', quantity: '', note: '' });
      loadMovements();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const productName = useMemo(() => {
    const m = new Map((products || []).map((p) => [p.id, p.name]));
    return (id) => m.get(id) || '—';
  }, [products]);

  if (!products || !movements) return <Loading />;

  return (
    <div>
      <PageHeader title={`Inventário — ${title}`} subtitle={isEntrada ? 'Registe entradas em armazém (aumentam o stock).' : 'Registe saídas de armazém (reduzem o stock).'} />
      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      <div className="card card-pad" style={{ marginBottom: 18, maxWidth: 560 }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field" style={{ margin: 0, flex: '1 1 220px' }}>
            <label>Produto</label>
            <select value={form.productId} onChange={(e) => update('productId', e.target.value)}>
              <option value="">— escolher —</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name} (stock: {p.stockQuantity ?? 0})</option>)}
            </select>
          </div>
          <div className="field" style={{ margin: 0, width: 110 }}>
            <label>Quantidade</label>
            <input type="number" min="1" value={form.quantity} onChange={(e) => update('quantity', e.target.value)} />
          </div>
          <div className="field" style={{ margin: 0, flex: '1 1 160px' }}>
            <label>Nota (opcional)</label>
            <input value={form.note} onChange={(e) => update('note', e.target.value)} />
          </div>
          <button className="btn btn-accent" type="submit" disabled={saving}>{saving ? 'A registar…' : `Registar ${isEntrada ? 'entrada' : 'saída'}`}</button>
        </form>
      </div>

      {movements.length === 0 ? (
        <div className="empty-state"><h3>Sem {title.toLowerCase()}</h3><p>Os movimentos registados aparecem aqui.</p></div>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>Data</th><th>Produto</th><th style={{ textAlign: 'right' }}>Qtd.</th><th>Nota</th></tr></thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td>{formatDateTime(m.createdAt)}</td>
                  <td>{m.product?.name || productName(m.productId)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{isEntrada ? '+' : '−'}{m.quantity}</td>
                  <td>{m.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
