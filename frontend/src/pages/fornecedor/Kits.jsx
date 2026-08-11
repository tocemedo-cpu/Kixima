// src/pages/fornecedor/Kits.jsx
// Catálogo → Kits. Cria pacotes de produtos da própria empresa e lista-os.
import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../api/client';
import { PageHeader, Loading, ErrorBanner, SuccessBanner } from '../../components/Common';
import { formatMoney } from '../../domain';
import { useI18n } from '../../i18n';

export default function Kits() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [products, setProducts] = useState(null);
  const [kits, setKits] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState([{ productId: '', quantity: 1 }]);
  const [saving, setSaving] = useState(false);

  function loadKits() {
    api.get('/api/kits').then(setKits).catch((e) => setError(e.message));
  }
  useEffect(() => {
    api.get('/api/catalog', { supplierId: user.companyId }).then(setProducts).catch((e) => setError(e.message));
    loadKits();
  }, [user.companyId]);

  const setLine = (i, k, v) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)));
  const addLine = () => setLines((ls) => [...ls, { productId: '', quantity: 1 }]);
  const removeLine = (i) => setLines((ls) => ls.filter((_, idx) => idx !== i));

  function resetForm() {
    setName(''); setDescription(''); setLines([{ productId: '', quantity: 1 }]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setSuccess('');
    const items = lines.filter((l) => l.productId).map((l) => ({ productId: l.productId, quantity: Number(l.quantity) || 1 }));
    if (!name.trim()) return setError(t('Indique o nome do kit.'));
    if (items.length === 0) return setError(t('Adicione pelo menos um produto ao kit.'));
    setSaving(true);
    try {
      await api.post('/api/kits', { name, description: description || undefined, items });
      setSuccess(t('Kit criado.'));
      resetForm();
      setShowForm(false);
      loadKits();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    try { await api.del(`/api/kits/${id}`); loadKits(); } catch (e) { setError(e.message); }
  }

  const kitTotal = (kit) => kit.items.reduce((s, it) => s + Number(it.product?.unitPrice || 0) * it.quantity, 0);

  if (!products || !kits) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Catálogo — Kits"
        subtitle="Agrupe produtos num pacote para venda conjunta."
        action={<button className="btn btn-accent" onClick={() => { setShowForm((v) => !v); if (showForm) resetForm(); }}>{showForm ? t('Cancelar') : t('+ Novo kit')}</button>}
      />
      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      {showForm && (
        <div className="card card-pad" style={{ marginBottom: 18, maxWidth: 620 }}>
          <form onSubmit={handleSubmit}>
            <div className="field"><label>{t('Nome do kit')}</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="field"><label>{t('Descrição (opcional)')}</label><textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <div className="reg-section">{t('Produtos do kit')}</div>
            {lines.map((l, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 8 }}>
                <div className="field" style={{ margin: 0, flex: 1 }}>
                  <label>{t('Produto')}</label>
                  <select value={l.productId} onChange={(e) => setLine(i, 'productId', e.target.value)}>
                    <option value="">{t('— escolher —')}</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="field" style={{ margin: 0, width: 90 }}>
                  <label>{t('Qtd.')}</label>
                  <input type="number" min="1" value={l.quantity} onChange={(e) => setLine(i, 'quantity', e.target.value)} />
                </div>
                {lines.length > 1 ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeLine(i)}>×</button> : null}
              </div>
            ))}
            <button type="button" className="btn btn-ghost btn-sm" onClick={addLine} style={{ marginBottom: 12 }}>{t('+ Adicionar produto')}</button>
            <div><button className="btn btn-accent" type="submit" disabled={saving}>{saving ? t('A criar…') : t('Criar kit')}</button></div>
          </form>
        </div>
      )}

      {kits.length === 0 ? (
        <div className="empty-state"><h3>{t('Sem kits')}</h3><p>{t('Crie pacotes de produtos para facilitar a venda conjunta.')}</p></div>
      ) : (
        <div className="grid-cols grid-2">
          {kits.map((kit) => (
            <div key={kit.id} className="card card-pad">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <strong style={{ fontSize: 15 }}>{kit.name}</strong>
                  {kit.description ? <p className="helptext" style={{ marginTop: 2 }}>{kit.description}</p> : null}
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => remove(kit.id)}>{t('Remover')}</button>
              </div>
              <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 13.5 }}>
                {kit.items.map((it) => (
                  <li key={it.id}>{it.quantity}× {it.product?.name || '—'}</li>
                ))}
              </ul>
              <div style={{ marginTop: 10, fontWeight: 700 }}>{t('Total:')} {formatMoney(kitTotal(kit), kit.items[0]?.product?.currency || 'AOA')}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
