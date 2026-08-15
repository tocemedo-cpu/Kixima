// src/pages/fornecedor/Inventory.jsx
// Inventário → Stock. Lista os produtos da própria empresa com o estoque real e
// permite editar quantidade, estoque mínimo, armazém e disponibilidade em linha.
// Linhas com stock no/abaixo do mínimo são destacadas.
import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../api/client';
import { PageHeader, Loading, ErrorBanner, SuccessBanner, StatCard } from '../../components/Common';
import Badge from '../../components/Badge';
import { useI18n } from '../../i18n';

const AVAILABILITY = ['Em stock', 'Sob encomenda', 'Esgotado'];
const isLow = (p) => p.stockQuantity != null && p.minStock != null && p.stockQuantity <= p.minStock;

export default function Inventory() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [products, setProducts] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState(null); // id em edição
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);

  function load() {
    api.get('/api/catalog', { supplierId: user.companyId }).then(setProducts).catch((e) => setError(e.message));
  }
  useEffect(load, [user.companyId]);

  function startEdit(p) {
    setSuccess('');
    setEditing(p.id);
    setDraft({
      stockQuantity: p.stockQuantity ?? '',
      minStock: p.minStock ?? '',
      warehouse: p.warehouse ?? '',
      availability: p.availability ?? 'Em stock',
    });
  }

  async function save(id) {
    setSaving(true);
    setError('');
    try {
      await api.patch(`/api/catalog/${id}/stock`, {
        stockQuantity: draft.stockQuantity === '' ? undefined : Number(draft.stockQuantity),
        minStock: draft.minStock === '' ? undefined : Number(draft.minStock),
        warehouse: draft.warehouse || undefined,
        availability: draft.availability || undefined,
      });
      setSuccess(t('Inventário atualizado.'));
      setEditing(null);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!products) return <Loading />;

  const lowCount = products.filter(isLow).length;
  const totalUnits = products.reduce((s, p) => s + (p.stockQuantity || 0), 0);

  return (
    <div>
      <PageHeader title="Inventário — Stock" subtitle="Gira as quantidades em armazém dos seus produtos." />
      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      <div className="grid-cols grid-3" style={{ marginBottom: 18 }}>
        <StatCard label="Produtos" value={products.length} />
        <StatCard label="Unidades em stock" value={totalUnits} />
        <StatCard label="Abaixo do mínimo" value={lowCount} sub={lowCount ? 'Requer reposição' : 'Tudo acima do mínimo'} />
      </div>

      {products.length === 0 ? (
        <div className="empty-state">
          <h3>{t('Sem produtos')}</h3>
          <p>{t('Publique itens no catálogo para gerir o respetivo stock.')}</p>
        </div>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>{t('Produto')}</th><th>{t('Armazém')}</th><th>{t('Stock')}</th><th>{t('Mínimo')}</th><th>{t('Disponibilidade')}</th><th></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const low = isLow(p);
                const inEdit = editing === p.id;
                return (
                  <tr key={p.id} style={low ? { background: 'rgba(227,6,19,0.05)' } : undefined}>
                    <td>
                      <strong>{p.name}</strong>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-400)' }}>{p.sku || p.category}</div>
                    </td>
                    {inEdit ? (
                      <>
                        <td><input value={draft.warehouse} onChange={(e) => setDraft((d) => ({ ...d, warehouse: e.target.value }))} /></td>
                        <td><input type="number" min="0" style={{ width: 80 }} value={draft.stockQuantity} onChange={(e) => setDraft((d) => ({ ...d, stockQuantity: e.target.value }))} /></td>
                        <td><input type="number" min="0" style={{ width: 80 }} value={draft.minStock} onChange={(e) => setDraft((d) => ({ ...d, minStock: e.target.value }))} /></td>
                        <td>
                          <select aria-label={t('Disponibilidade')} value={draft.availability} onChange={(e) => setDraft((d) => ({ ...d, availability: e.target.value }))}>
                            {AVAILABILITY.map((a) => <option key={a} value={a}>{t(a)}</option>)}
                          </select>
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button className="btn btn-accent btn-sm" disabled={saving} onClick={() => save(p.id)}>{t('Guardar')}</button>{' '}
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>{t('Cancelar')}</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{p.warehouse || '—'}</td>
                        <td>
                          <strong>{p.stockQuantity ?? '—'}</strong>{' '}
                          {low ? <Badge tone="danger">baixo</Badge> : null}
                        </td>
                        <td>{p.minStock ?? '—'}</td>
                        <td>{p.availability || '—'}</td>
                        <td><button className="btn btn-ghost btn-sm" onClick={() => startEdit(p)}>{t('Editar')}</button></td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
