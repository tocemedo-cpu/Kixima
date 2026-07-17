// src/pages/fornecedor/CatalogManage.jsx
import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../api/client';
import { PageHeader, Loading, ErrorBanner, SuccessBanner } from '../../components/Common';
import { formatMoney } from '../../domain';

const EMPTY_FORM = { name: '', description: '', category: '', unitPrice: '', currency: 'AOA', leadTimeDays: '' };

export default function CatalogManage() {
  const { user } = useAuth();
  const [products, setProducts] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    api.get('/api/catalog', { supplierId: user.companyId }).then(setProducts).catch((e) => setError(e.message));
  }

  useEffect(load, [user.companyId]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      await api.post('/api/catalog', {
        ...form,
        unitPrice: Number(form.unitPrice),
        leadTimeDays: form.leadTimeDays ? Number(form.leadTimeDays) : undefined,
      });
      setSuccess('Item publicado no catálogo.');
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate(id) {
    try {
      await api.del(`/api/catalog/${id}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <PageHeader
        title="Catálogo de Produtos e Serviços"
        subtitle="Gira os itens que a sua empresa oferece na plataforma."
        action={<button className="btn btn-accent" onClick={() => setShowForm((v) => !v)}>{showForm ? 'Cancelar' : '+ Novo item'}</button>}
      />

      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      {showForm && (
        <div className="card card-pad" style={{ marginBottom: 20, maxWidth: 480 }}>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Nome</label>
              <input required value={form.name} onChange={(e) => update('name', e.target.value)} />
            </div>
            <div className="field">
              <label>Descrição</label>
              <textarea rows={2} value={form.description} onChange={(e) => update('description', e.target.value)} />
            </div>
            <div className="field">
              <label>Categoria</label>
              <input required value={form.category} onChange={(e) => update('category', e.target.value)} placeholder="Ex.: Válvulas, Hidráulica…" />
            </div>
            <div className="grid-cols grid-2">
              <div className="field">
                <label>Preço unitário (AOA)</label>
                <input required type="number" min="0" step="0.01" value={form.unitPrice} onChange={(e) => update('unitPrice', e.target.value)} />
              </div>
              <div className="field">
                <label>Prazo de entrega (dias)</label>
                <input type="number" min="0" value={form.leadTimeDays} onChange={(e) => update('leadTimeDays', e.target.value)} />
              </div>
            </div>
            <button className="btn btn-accent" disabled={submitting} type="submit">
              {submitting ? 'A publicar…' : 'Publicar item'}
            </button>
          </form>
        </div>
      )}

      {!products ? (
        <Loading />
      ) : products.length === 0 ? (
        <div className="empty-state">
          <h3>Ainda não publicou nenhum item</h3>
          <p>Adicione produtos ou serviços para começar a receber ordens de compra.</p>
        </div>
      ) : (
        <div className="grid-cols grid-3">
          {products.map((p) => (
            <div key={p.id} className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="badge badge-neutral">{p.category}</span>
              <strong>{p.name}</strong>
              <p style={{ fontSize: 13, color: 'var(--ink-600)', flex: 1 }}>{p.description}</p>
              <strong className="mono">{formatMoney(p.unitPrice, p.currency)}</strong>
              <button className="btn btn-ghost btn-sm" onClick={() => handleDeactivate(p.id)}>Remover</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
