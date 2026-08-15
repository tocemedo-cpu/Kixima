// src/pages/fornecedor/StockMovements.jsx
// Inventário → Entradas / Saídas. Regista movimentos de inventário (que ajustam
// o stock do produto) e lista o histórico do tipo correspondente à rota.
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../api/client';
import { PageHeader, Loading, ErrorBanner, SuccessBanner , Field } from '../../components/Common';
import { formatDateTime } from '../../domain';
import { useI18n } from '../../i18n';

export default function StockMovements() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { pathname } = useLocation();
  const isEntrada = pathname.endsWith('/entradas');
  const type = isEntrada ? 'ENTRADA' : 'SAIDA';
  const title = isEntrada ? 'Entradas' : 'Saídas';

  const [products, setProducts] = useState(null);
  const [movements, setMovements] = useState(null);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState({ productId: '', quantity: '', note: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  function loadMovements() {
    // A resposta traz envelope (itens + total). O total é o que permite dizer
    // quantos movimentos existem em vez de mostrar os primeiros e deixar
    // acreditar que são todos.
    api.get('/api/catalog/movements', { type, limit: 100 })
      .then((r) => { setMovements(r.itens || []); setTotal(r.total || 0); })
      .catch((e) => setError(e.message));
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
    if (!form.productId) return setError(t('Escolha o produto.'));
    if (!form.quantity || Number(form.quantity) <= 0) return setError(t('Indique uma quantidade válida.'));
    setSaving(true);
    try {
      await api.post('/api/catalog/movements', { productId: form.productId, type, quantity: Number(form.quantity), note: form.note || undefined });
      setSuccess(title === 'Entradas' ? t('Entrada registada. O stock foi atualizado.') : t('Saída registada. O stock foi atualizado.'));
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
      <PageHeader title={`${t('Inventário')} — ${t(title)}`} subtitle={isEntrada ? 'Registe entradas em armazém (aumentam o stock).' : 'Registe saídas de armazém (reduzem o stock).'} />
      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      <div className="card card-pad" style={{ marginBottom: 18, maxWidth: 560 }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Field label={t('Produto')} style={{ margin: 0, flex: '1 1 220px' }}>
            {(id) => (<>
              <select id={id} value={form.productId} onChange={(e) => update('productId', e.target.value)}>
                <option value="">{t('— escolher —')}</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({t('stock')}: {p.stockQuantity ?? 0})</option>)}
              </select>
            </>)}
          </Field>
          <Field label={t('Quantidade')} style={{ margin: 0, width: 110 }}>
            {(id) => (<>
              <input id={id} type="number" min="1" value={form.quantity} onChange={(e) => update('quantity', e.target.value)} />
            </>)}
          </Field>
          <Field label={t('Nota (opcional)')} style={{ margin: 0, flex: '1 1 160px' }}>
            {(id) => (<>
              <input id={id} value={form.note} onChange={(e) => update('note', e.target.value)} />
            </>)}
          </Field>
          <button className="btn btn-accent" type="submit" disabled={saving}>{saving ? t('A registar…') : (isEntrada ? t('Registar entrada') : t('Registar saída'))}</button>
        </form>
      </div>

      {movements.length === 0 ? (
        <div className="empty-state"><h3>{t('Sem {x}', { x: t(title).toLowerCase() })}</h3><p>{t('Os movimentos registados aparecem aqui.')}</p></div>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <div className="bz-scroll-x">
          <table>
            <thead><tr><th>{t('Data')}</th><th>{t('Produto')}</th><th style={{ textAlign: 'right' }}>{t('Qtd.')}</th><th>{t('Nota')}</th></tr></thead>
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
          {/* Dizer quantos existem, e não só mostrar os que couberam. Uma lista
              cortada em silêncio é pior do que uma que não abre: quem a lê
              toma decisões com ela a acreditar que está completa. */}
          {total > movements.length ? (
            <p className="helptext" style={{ margin: '10px 0 0' }}>
              {t('A mostrar os {n} movimentos mais recentes de {total} no total.', { n: movements.length, total })}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
