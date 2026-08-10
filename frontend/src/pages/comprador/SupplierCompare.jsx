// src/pages/comprador/SupplierCompare.jsx
// Comparar fornecedores (SÓ comprador). Reúne 3–5 fornecedores do mesmo item e
// compara preço, prazo de entrega, material, garantia, norma, origem, incoterm e
// avaliação — com um gráfico de barras (Preço e Prazo). Liga a
// /api/marketplace/compare?productId=...
import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { Loading, ErrorBanner } from '../../components/Common';
import { Crumbs, PageHead } from '../../components/BuyerUI';
import { Stars } from '../../components/icons';
import { formatMoney } from '../../domain';

const BAR = '#5b8def';   // barra (uma só cor por gráfico — série única)
const BEST = '#16a34a';  // melhor valor (destaque + rótulo, nunca só cor)
const priceOf = (o) => Number(o.promoPrice ?? o.unitPrice) || 0;

// Gráfico de barras horizontais para UMA medida (série única, menor = melhor).
function CompareBars({ title, items, fmt }) {
  const max = Math.max(1, ...items.map((i) => i.value || 0));
  return (
    <div className="cmp-chart">
      <div className="cmp-chart-title">{title}</div>
      <div className="cmp-bars">
        {items.map((i) => (
          <div className="cmp-bar-row" key={i.id}>
            <div className="cmp-bar-label" title={i.label}>{i.label}</div>
            <div className="cmp-bar-track">
              {/* Escala a 62% do trilho para o rótulo ter espaço fixo — mantém
                  as barras proporcionais entre si (flex-shrink desativado no CSS). */}
              <div
                className="cmp-bar-fill"
                style={{ width: `${((i.value || 0) / max) * 62}%`, background: i.best ? BEST : BAR }}
                title={fmt(i.value)}
              />
              <span className="cmp-bar-val">
                {i.value != null ? fmt(i.value) : '—'}{i.best ? <span className="cmp-best"> ★ melhor</span> : null}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SupplierCompare() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const productId = sp.get('productId') || '';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setError(''); setData(null);
    if (!productId) { setError('Produto não indicado.'); return; }
    api.get('/api/marketplace/compare', { productId }).then(setData).catch((e) => setError(e.message));
  }, [productId]);

  if (error) return <div><Crumbs trail={['Home', 'Comparar fornecedores']} /><ErrorBanner message={error} /></div>;
  if (!data) return <Loading />;

  const offers = data.offers || [];
  const itemName = data.base?.unspscTitle || data.base?.name || 'Item';

  // Melhores valores (menor preço; menor prazo, ignorando nulos).
  const bestPrice = Math.min(...offers.map(priceOf).filter((n) => n > 0));
  const leadVals = offers.map((o) => o.leadTimeDays).filter((n) => n != null);
  const bestLead = leadVals.length ? Math.min(...leadVals) : null;

  const shortName = (o) => (o.supplier?.name || '—').split(',')[0];

  return (
    <div>
      <Crumbs trail={['Home', 'Catálogo', 'Comparar fornecedores']} />
      <PageHead
        title="Comparar fornecedores"
        subtitle={`Ofertas para: ${itemName}${data.base?.unspscCode ? ` · UNSPSC ${data.base.unspscCode}` : ''}`}
        actions={<button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Voltar</button>}
      />

      {offers.length < 2 ? (
        <div className="empty-state">
          <h3>Sem comparação disponível</h3>
          <p>De momento só há {offers.length === 1 ? 'um fornecedor' : 'nenhum fornecedor'} para este item. A comparação aparece quando houver 2 ou mais.</p>
        </div>
      ) : (
        <>
          {/* Gráficos: preço e prazo (menor = melhor) */}
          <div className="cmp-charts">
            <CompareBars
              title="Preço (menor é melhor)"
              fmt={(v) => formatMoney(v, offers[0]?.currency)}
              items={offers.map((o) => ({ id: o.id, label: shortName(o), value: priceOf(o), best: priceOf(o) === bestPrice }))}
            />
            <CompareBars
              title="Prazo de entrega (dias — menor é melhor)"
              fmt={(v) => `${v} dias`}
              items={offers.map((o) => ({ id: o.id, label: shortName(o), value: o.leadTimeDays, best: bestLead != null && o.leadTimeDays === bestLead }))}
            />
          </div>

          {/* Tabela detalhada */}
          <div className="bz-card bz-tablewrap" style={{ marginTop: 16 }}>
            <table className="bz-table cmp-table">
              <thead>
                <tr>
                  <th>Fornecedor</th><th>Preço</th><th>Prazo</th><th>Material</th>
                  <th>Garantia</th><th>Norma / Certificações</th><th>Origem</th>
                  <th>Incoterm</th><th>Avaliação</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((o) => {
                  const p = priceOf(o);
                  const certs = (o.certifications || []).join(', ');
                  return (
                    <tr key={o.id}>
                      <td>
                        <strong>{o.supplier?.name || '—'}</strong>
                        <span className="bz-sub2">
                          {[o.supplier?.city, o.supplier?.country].filter(Boolean).join(', ')}
                          {o.supplier?.verified ? ' · ✓ Verificado' : ''}
                        </span>
                      </td>
                      <td className={p === bestPrice ? 'cmp-win' : ''}>
                        {formatMoney(p, o.currency)}{p === bestPrice ? <span className="cmp-tag">melhor</span> : null}
                      </td>
                      <td className={bestLead != null && o.leadTimeDays === bestLead ? 'cmp-win' : ''}>
                        {o.leadTimeDays != null ? `${o.leadTimeDays} dias` : '—'}
                      </td>
                      <td>{o.material || '—'}</td>
                      <td>{o.warranty || '—'}</td>
                      <td>{[o.standard, certs].filter(Boolean).join(' · ') || '—'}</td>
                      <td>{o.countryOfOrigin || '—'}</td>
                      <td>{o.incoterm || '—'}</td>
                      <td>{o.rating ? <span><Stars value={o.rating} /> {o.rating.toFixed(1)}</span> : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="helptext" style={{ marginTop: 10 }}>
            Comparação de {offers.length} fornecedor{offers.length === 1 ? '' : 'es'} para o mesmo item. Abre o produto de cada fornecedor no catálogo para encomendar.
          </p>
        </>
      )}
    </div>
  );
}
