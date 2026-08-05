// src/pages/fornecedor/CatalogManage.jsx
// Gestão do catálogo do Vendedor. Cadastro do produto num formulário enxuto de
// 3 abas — apenas o essencial: Produto (nome, categoria, marca, descrição,
// unidade), Preço & Disponibilidade e Imagens & Documentos.
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../api/client';
import { PageHeader, Loading, ErrorBanner, SuccessBanner } from '../../components/Common';
import { formatMoney } from '../../domain';
import ProductCover from '../../components/ProductCover';
import { Icon } from '../../components/icons';
import { useI18n } from '../../i18n';

const CATEGORIES = [
  'Válvulas', 'Hidráulica', 'Inspeção & Ensaios', 'Logística & Transporte',
  'Engenharia', 'Equipamentos', 'Formação & Certificação', 'Materiais', 'Offshore', 'Consultoria',
];
const CURRENCIES = ['AOA', 'USD', 'EUR'];
const AVAILABILITY = ['Em stock', 'Sob encomenda', 'Esgotado'];

// Documentos relevantes para o setor (compliance). Opcionais.
const DOC_TYPES = [
  ['FICHA_TECNICA', 'Ficha Técnica'],
  ['CERTIFICADO', 'Certificados'],
  ['CATALOGO', 'Catálogo PDF'],
];

const TABS = ['Produto', 'Preço & Disponibilidade', 'Imagens & Documentos'];

// Apenas os campos essenciais/importantes para publicar um item no marketplace.
const EMPTY_FORM = {
  // Produto
  name: '', category: '', brand: '', description: '', measurementUnit: '',
  // Preço & disponibilidade
  currency: 'AOA', unitPrice: '', promoPrice: '',
  availability: 'Em stock', stockQuantity: '', leadTimeDays: '',
};

export default function CatalogManage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [products, setProducts] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  const [mainImage, setMainImage] = useState(null); // { file, preview }
  const [gallery, setGallery] = useState([]);        // [{ file, preview }]
  const [docs, setDocs] = useState({});              // { TYPE: File[] }
  const [submitting, setSubmitting] = useState(false);

  // gestão da foto do cartão existente (produtos já publicados)
  const [uploadingId, setUploadingId] = useState(null);
  const cardInputs = useRef({});

  function load() {
    api.get('/api/catalog', { supplierId: user.companyId }).then(setProducts).catch((e) => setError(e.message));
  }
  useEffect(load, [user.companyId]);

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  function resetForm() {
    gallery.forEach((g) => URL.revokeObjectURL(g.preview));
    if (mainImage) URL.revokeObjectURL(mainImage.preview);
    setForm(EMPTY_FORM);
    setMainImage(null);
    setGallery([]);
    setDocs({});
    setTab(0);
  }

  function addMainImage(fileList) {
    const file = fileList[0];
    if (!file || !file.type.startsWith('image/')) return;
    if (mainImage) URL.revokeObjectURL(mainImage.preview);
    setMainImage({ file, preview: URL.createObjectURL(file) });
  }
  function addGallery(fileList) {
    const imgs = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    setGallery((g) => [...g, ...imgs.map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
  }
  function removeGallery(i) {
    setGallery((g) => {
      URL.revokeObjectURL(g[i].preview);
      return g.filter((_, idx) => idx !== i);
    });
  }
  function addDocs(type, fileList) {
    const files = Array.from(fileList);
    setDocs((d) => ({ ...d, [type]: [...(d[type] || []), ...files] }));
  }
  function removeDoc(type, i) {
    setDocs((d) => ({ ...d, [type]: d[type].filter((_, idx) => idx !== i) }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    // Validação dos campos obrigatórios com salto para a aba certa.
    if (!form.name.trim()) { setTab(0); setError('Indique o nome do produto.'); return; }
    if (!form.category.trim()) { setTab(0); setError('Indique a categoria.'); return; }
    if (!form.description.trim()) { setTab(0); setError('Escreva uma descrição curta (aparece nos cartões).'); return; }
    if (!form.unitPrice) { setTab(1); setError('Indique o preço unitário.'); return; }

    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => { if (v !== '' && v != null) fd.append(k, v); });
    if (mainImage) fd.append('mainImage', mainImage.file);
    gallery.forEach((g) => fd.append('gallery', g.file));
    DOC_TYPES.forEach(([type]) => (docs[type] || []).forEach((file) => fd.append(type, file)));

    setSubmitting(true);
    try {
      await api.postForm('/api/catalog', fd);
      setSuccess('Produto publicado no catálogo com a ficha completa.');
      resetForm();
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCardPhoto(productId, file) {
    if (!file) return;
    setUploadingId(productId);
    try {
      await api.upload(`/api/catalog/${productId}/image`, file);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingId(null);
    }
  }
  async function handleDeactivate(id) {
    try { await api.del(`/api/catalog/${id}`); load(); } catch (err) { setError(err.message); }
  }

  return (
    <div>
      <PageHeader
        title="Catálogo de Produtos e Serviços"
        subtitle="Publique os seus itens com o essencial — produto, preço e disponibilidade, imagens e documentos."
        action={<button className="btn btn-accent" onClick={() => { setShowForm((v) => !v); if (showForm) resetForm(); }}>{showForm ? 'Cancelar' : '+ Novo item'}</button>}
      />

      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      {showForm && (
        <div className="card card-pad" style={{ marginBottom: 22 }}>
          <div className="tabs">
            {TABS.map((t, i) => (
              <button key={t} type="button" className={`tab ${tab === i ? 'tab-active' : ''}`} onClick={() => setTab(i)}>
                <span className="tab-num">{i + 1}</span>{t}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="prod-form">
            {/* ABA 1 — Produto */}
            <div className="tab-panel" style={{ display: tab === 0 ? 'block' : 'none' }}>
              <div className="field">
                <label>Nome do Produto <span className="req">*</span></label>
                <input value={form.name} onChange={(e) => update('name', e.target.value)} />
              </div>
              <div className="grid-cols grid-2">
                <div className="field">
                  <label>Categoria <span className="req">*</span></label>
                  <input list="cat-list" value={form.category} onChange={(e) => update('category', e.target.value)} placeholder="Ex.: Válvulas, Inspeção & Ensaios…" />
                  <datalist id="cat-list">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
                </div>
                <div className="field">
                  <label>Marca</label>
                  <input value={form.brand} onChange={(e) => update('brand', e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label>Descrição Curta <span className="req">*</span></label>
                <textarea rows={3} value={form.description} onChange={(e) => update('description', e.target.value)} />
                <small className="helptext">Aparece nos cartões do marketplace.</small>
              </div>
              <div className="field" style={{ maxWidth: 260 }}>
                <label>Unidade de Medida</label>
                <input value={form.measurementUnit} onChange={(e) => update('measurementUnit', e.target.value)} placeholder="Ex.: un, m, kg, caixa" />
              </div>
            </div>

            {/* ABA 2 — Preço & Disponibilidade */}
            <div className="tab-panel" style={{ display: tab === 1 ? 'block' : 'none' }}>
              <div className="grid-cols grid-2">
                <div className="field">
                  <label>Moeda</label>
                  <select value={form.currency} onChange={(e) => update('currency', e.target.value)}>
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Preço Unitário <span className="req">*</span></label>
                  <input type="number" min="0" step="0.01" value={form.unitPrice} onChange={(e) => update('unitPrice', e.target.value)} />
                </div>
                <div className="field">
                  <label>Preço Promocional</label>
                  <input type="number" min="0" step="0.01" value={form.promoPrice} onChange={(e) => update('promoPrice', e.target.value)} />
                </div>
                <div className="field">
                  <label>Disponibilidade</label>
                  <select value={form.availability} onChange={(e) => update('availability', e.target.value)}>
                    {AVAILABILITY.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Quantidade em Stock</label>
                  <input type="number" min="0" value={form.stockQuantity} onChange={(e) => update('stockQuantity', e.target.value)} />
                </div>
                <div className="field">
                  <label>Prazo de Entrega (dias)</label>
                  <input type="number" min="0" value={form.leadTimeDays} onChange={(e) => update('leadTimeDays', e.target.value)} />
                </div>
              </div>
            </div>

            {/* ABA 3 — Imagens & Documentos */}
            <div className="tab-panel" style={{ display: tab === 2 ? 'block' : 'none' }}>
              <label className="reg-section" style={{ display: 'block' }}>Imagem Principal</label>
              <Dropzone onFiles={addMainImage} hint="Arraste a imagem principal ou clique para escolher">
                {mainImage ? <img src={mainImage.preview} alt="principal" className="dz-thumb" /> : null}
              </Dropzone>

              <label className="reg-section" style={{ display: 'block', marginTop: 16 }}>Galeria</label>
              <Dropzone multiple onFiles={addGallery} hint="Arraste várias imagens ou clique para escolher" />
              {gallery.length > 0 && (
                <div className="dz-grid">
                  {gallery.map((g, i) => (
                    <div key={i} className="dz-item">
                      <img src={g.preview} alt={`galeria ${i + 1}`} />
                      <button type="button" className="dz-remove" onClick={() => removeGallery(i)} aria-label="Remover">×</button>
                    </div>
                  ))}
                </div>
              )}

              <label className="reg-section" style={{ display: 'block', marginTop: 16 }}>Documentos</label>
              <p className="helptext" style={{ marginTop: 0 }}>PDF ou imagem, até 15 MB cada. Opcional — pode anexar vários por tipo.</p>
              {DOC_TYPES.map(([type, label]) => (
                <div className="field" key={type}>
                  <label>{label}</label>
                  <input type="file" multiple accept="application/pdf,image/*" onChange={(e) => { addDocs(type, e.target.files); e.target.value = ''; }} />
                  {(docs[type] || []).length > 0 && (
                    <ul className="doc-chips">
                      {docs[type].map((f, i) => (
                        <li key={i}><Icon name="invoice" size={13} /> {f.name}
                          <button type="button" onClick={() => removeDoc(type, i)} aria-label="Remover">×</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>

            <div className="prod-form-footer">
              <div className="tab-nav">
                <button type="button" className="btn btn-ghost" disabled={tab === 0} onClick={() => setTab((t) => Math.max(0, t - 1))}>Anterior</button>
                {tab < TABS.length - 1
                  ? <button type="button" className="btn btn-ghost" onClick={() => setTab((t) => Math.min(TABS.length - 1, t + 1))}>Seguinte</button>
                  : null}
              </div>
              <button className="btn btn-accent" type="submit" disabled={submitting}>
                {submitting ? 'A publicar…' : 'Publicar produto'}
              </button>
            </div>
          </form>
        </div>
      )}

      {!products ? (
        <Loading />
      ) : products.length === 0 ? (
        <div className="empty-state">
          <h3>{t('Ainda não publicou nenhum item')}</h3>
          <p>Adicione produtos ou serviços para começar a receber ordens de compra.</p>
        </div>
      ) : (
        <div className="mk-grid">
          {products.map((p) => (
            <div key={p.id} className="mk-card">
              <div className="mk-cover">
                <ProductCover imageUrl={p.imageUrl} category={p.category} name={p.name} />
                <input ref={(el) => (cardInputs.current[p.id] = el)} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleCardPhoto(p.id, e.target.files[0])} />
                <button type="button" className="mk-photo-btn" onClick={() => cardInputs.current[p.id]?.click()} disabled={uploadingId === p.id}>
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

// Área de arrastar/soltar + clique. Chama onFiles(FileList).
function Dropzone({ onFiles, hint, multiple, children }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);
  return (
    <div
      className={`dropzone ${over ? 'dropzone-over' : ''}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files); }}
    >
      <input ref={inputRef} type="file" accept="image/*" multiple={multiple} style={{ display: 'none' }} onChange={(e) => { if (e.target.files?.length) onFiles(e.target.files); e.target.value = ''; }} />
      {children}
      <div className="dz-hint"><Icon name="catalog" size={16} /> {hint}</div>
    </div>
  );
}
