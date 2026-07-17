// src/pages/fornecedor/CatalogManage.jsx
// Gestão do catálogo do fornecedor — criar itens, carregar foto real do produto
// (aparece no marketplace) e remover. Totalmente funcional contra a API.
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../api/client';
import { PageHeader, Loading, ErrorBanner, SuccessBanner } from '../../components/Common';
import { formatMoney } from '../../domain';
import ProductCover from '../../components/ProductCover';
import { Icon } from '../../components/icons';

const EMPTY_FORM = { name: '', description: '', category: '', unitPrice: '', currency: 'AOA', leadTimeDays: '' };
const CATEGORIES = [
  'Válvulas', 'Hidráulica', 'Inspeção & Ensaios', 'Logística & Transporte',
  'Engenharia', 'Equipamentos', 'Formação & Certificação', 'Materiais', 'Offshore', 'Consultoria',
];

export default function CatalogManage() {
  const { user } = useAuth();
  const [products, setProducts] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingId, setUploadingId] = useState(null);
  const fileInputs = useRef({});

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
      setSuccess('Item publicado no catálogo. Adicione uma foto para destacá-lo no marketplace.');
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePhoto(productId, file) {
    if (!file) return;
    setError('');
    setSuccess('');
    setUploadingId(productId);
    try {
      await api.upload(`/api/catalog/${productId}/image`, file);
      setSuccess('Foto do produto atualizada.');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingId(null);
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
        subtitle="Gira os itens que a sua empresa oferece — com foto real, aparecem em destaque no marketplace."
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
              <input required list="cat-list" value={form.category} onChange={(e) => update('category', e.target.value)} placeholder="Ex.: Válvulas, Inspeção & Ensaios…" />
              <datalist id="cat-list">
                {CATEGORIES.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div className="grid-cols grid-2">
              <div className="field">
                <label>Preço unitário (Kz)</label>
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
        <div className="mk-grid">
          {products.map((p) => (
            <div key={p.id} className="mk-card">
              <div className="mk-cover">
                <ProductCover imageUrl={p.imageUrl} category={p.category} name={p.name} />
                <input
                  ref={(el) => (fileInputs.current[p.id] = el)}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => handlePhoto(p.id, e.target.files[0])}
                />
                <button
                  type="button"
                  className="mk-photo-btn"
                  onClick={() => fileInputs.current[p.id]?.click()}
                  disabled={uploadingId === p.id}
                >
                  <Icon name="catalog" size={13} />
                  {uploadingId === p.id ? 'A enviar…' : p.imageUrl ? 'Trocar foto' : 'Carregar foto'}
                </button>
              </div>
              <div className="mk-body">
                <div className="mk-supplier"><span className="badge badge-neutral">{p.category}</span></div>
                <strong className="mk-title" style={{ cursor: 'default' }}>{p.name}</strong>
                <p className="mk-desc">{p.description}</p>
                <div className="mk-meta">
                  <span className="mk-price">{formatMoney(p.unitPrice, p.currency)}</span>
                  {p.leadTimeDays ? <span className="mk-lead">Prazo {p.leadTimeDays} dias</span> : null}
                </div>
                <div className="mk-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => handleDeactivate(p.id)}>Remover</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
