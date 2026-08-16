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
import { useI18n } from '../../i18n';

const BAR = '#5b8def';   // barra (uma só cor por gráfico — série única)
const BEST = '#16a34a';  // melhor valor (destaque + rótulo, nunca só cor)
const priceOf = (o) => Number(o.promoPrice ?? o.unitPrice) || 0;

// Gráfico de barras horizontais para UMA medida (série única, menor = melhor).
function CompareBars({ title, items, fmt }) {
  const { t } = useI18n();
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
                {i.value != null ? fmt(i.value) : '—'}{i.best ? <span className="cmp-best"> ★ {t('melhor')}</span> : null}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SupplierCompare() {
  const { t } = useI18n();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const productId = sp.get('productId') || '';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setError(''); setData(null);
    if (!productId) { setError(t('Produto não indicado.')); return; }
    api.get('/api/marketplace/compare', { productId }).then(setData).catch((e) => setError(e.message));
  }, [productId]);

  if (error) return <div><Crumbs trail={[{ label: 'Home', to: '/comprador' }, 'Comparar fornecedores']} /><ErrorBanner message={error} /></div>;
  if (!data) return <Loading />;

  const offers = data.offers || [];
  const itemName = data.base?.unspscTitle || data.base?.name || t('Item');

  // Melhores valores (menor preço; menor prazo, ignorando nulos).
  const bestPrice = Math.min(...offers.map(priceOf).filter((n) => n > 0));
  const leadVals = offers.map((o) => o.leadTimeDays).filter((n) => n != null);
  const bestLead = leadVals.length ? Math.min(...leadVals) : null;

  const shortName = (o) => (o.supplier?.name || '—').split(',')[0];

  return (
    <div>
      <Crumbs trail={[{ label: 'Home', to: '/comprador' }, 'Catálogo', 'Comparar fornecedores']} />
      <PageHead
        title="Comparar fornecedores"
        subtitle={`${t('Ofertas para')}: ${itemName}${data.base?.unspscCode ? ` · UNSPSC ${data.base.unspscCode}` : ''}`}
        actions={<button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← {t('Voltar')}</button>}
      />

      {offers.length < 2 ? (
        <div className="empty-state">
          <h3>{t('Sem comparação disponível')}</h3>
          <p>{t('De momento só há')} {offers.length === 1 ? t('um fornecedor') : t('nenhum fornecedor')} {t('para este item. A comparação aparece quando houver 2 ou mais.')}</p>
        </div>
      ) : (
        <>
          {/* Gráficos: preço e prazo (menor = melhor) */}
          <div className="cmp-charts">
            <CompareBars
              title={t('Preço (menor é melhor)')}
              fmt={(v) => formatMoney(v, offers[0]?.currency)}
              items={offers.map((o) => ({ id: o.id, label: shortName(o), value: priceOf(o), best: priceOf(o) === bestPrice }))}
            />
            <CompareBars
              title={t('Prazo de entrega (dias — menor é melhor)')}
              fmt={(v) => `${v} ${t('dias')}`}
              items={offers.map((o) => ({ id: o.id, label: shortName(o), value: o.leadTimeDays, best: bestLead != null && o.leadTimeDays === bestLead }))}
            />
          </div>

          {/* Tabela detalhada */}
          <div className="bz-card bz-tablewrap" style={{ marginTop: 16 }}>
            <table className="bz-table cmp-table">
              <thead>
                <tr>
                  <th>{t('Fornecedor')}</th><th>{t('Preço')}</th><th>{t('Prazo')}</th><th>{t('Material')}</th>
                  <th>{t('Garantia')}</th><th>{t('Norma / Certificações')}</th><th>{t('Origem')}</th>
                  <th>{t('Incoterm')}</th><th>{t('Avaliação')}</th>
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
                          {o.supplier?.verified ? ` · ✓ ${t('Verificado')}` : ''}
                        </span>
                      </td>
                      <td className={p === bestPrice ? 'cmp-win' : ''}>
                        {formatMoney(p, o.currency)}{p === bestPrice ? <span className="cmp-tag">{t('melhor')}</span> : null}
                      </td>
                      <td className={bestLead != null && o.leadTimeDays === bestLead ? 'cmp-win' : ''}>
                        {o.leadTimeDays != null ? `${o.leadTimeDays} ${t('dias')}` : '—'}
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
            {t('Comparação de')} {offers.length} {offers.length === 1 ? t('fornecedor') : t('fornecedores')} {t('para o mesmo item. Abre o produto de cada fornecedor no catálogo para encomendar.')}
          </p>
        </>
      )}
    </div>
  );
}
