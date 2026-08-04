// src/pages/comprador/Catalog.jsx
// Produtos (Comprador) — catálogo com painel de filtros (categorias, faixa de
// preço, disponibilidade, fornecedor verificado, avaliação), separadores por
// estado, ordenação, comparação e paginação. Tudo derivado dos DADOS REAIS
// devolvidos por /api/catalog (contagens, preços, avaliações e stock reais —
// nada é inventado). Ligado à cesta e ao detalhe do produto.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { Loading, ErrorBanner } from '../../components/Common';
import { formatMoney } from '../../domain';
import { useCart } from './CartContext';
import { Icon, Stars } from '../../components/icons';
import ProductCover from '../../components/ProductCover';
import { Crumbs, PageHead } from '../../components/BuyerUI';
import { useI18n } from '../../i18n';

const PAGE_SIZES = [16, 24, 48];

// Classifica a disponibilidade real do produto em três grupos apresentáveis.
function availabilityOf(p) {
  const a = (p.availability || '').toLowerCase();
  if (a.includes('encomenda') || a.includes('sob')) return 'ENCOMENDA';
  if (p.leadTimeDays === 0 || (p.stockQuantity && p.stockQuantity > 0) || a.includes('stock') || a.includes('pronta')) return 'STOCK';
  return 'STOCK';
}

export default function Catalog() {
  const { t } = useI18n();
  const { addItem } = useCart();
  const [products, setProducts] = useState(null);
  const [error, setError] = useState('');

  // Filtros
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [avail, setAvail] = useState({ STOCK: false, ENCOMENDA: false });
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [tab, setTab] = useState('TODOS');
  const [sort, setSort] = useState('rel');
  const [view, setView] = useState('grid');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(16);

  const [added, setAdded] = useState(null);
  const [compare, setCompare] = useState([]); // ids selecionados para comparar
  const [showCompare, setShowCompare] = useState(false);

  useEffect(() => {
    api.get('/api/catalog').then(setProducts).catch((e) => setError(e.message));
  }, []);

  // Sempre que um filtro muda, volta à primeira página.
  useEffect(() => { setPage(1); }, [search, category, priceMin, priceMax, avail, onlyVerified, minRating, tab, sort, pageSize]);

  const categories = useMemo(() => {
    if (!products) return [];
    const map = new Map();
    products.forEach((p) => map.set(p.category, (map.get(p.category) || 0) + 1));
    return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [products]);

  const availCounts = useMemo(() => {
    const c = { STOCK: 0, ENCOMENDA: 0 };
    (products || []).forEach((p) => { c[availabilityOf(p)] += 1; });
    return c;
  }, [products]);

  const ratingCounts = useMemo(() => {
    const c = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    (products || []).forEach((p) => { if (p.rating) { const f = Math.floor(p.rating); if (c[f] != null) c[f] += 1; } });
    return c;
  }, [products]);

  const priceBounds = useMemo(() => {
    if (!products || !products.length) return { min: 0, max: 0 };
    const vals = products.map((p) => Number(p.promoPrice ?? p.unitPrice)).filter((n) => !Number.isNaN(n));
    return { min: Math.min(...vals), max: Math.max(...vals) };
  }, [products]);

  if (error) return <ErrorBanner message={error} />;
  if (!products) return <Loading />;

  const priceOf = (p) => Number(p.promoPrice ?? p.unitPrice) || 0;
  const isVerified = (p) => p.supplier?.verified || p.supplier?.status === 'APROVADA';

  // Aplica todos os filtros (menos o separador) para calcular as contagens dos tabs.
  const base = products.filter((p) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || [p.name, p.category, p.brand, p.model, p.manufacturer]
      .filter(Boolean).some((v) => v.toLowerCase().includes(q));
    const matchesCategory = !category || p.category === category;
    const price = priceOf(p);
    const matchesMin = !priceMin || price >= Number(priceMin);
    const matchesMax = !priceMax || price <= Number(priceMax);
    const anyAvail = !avail.STOCK && !avail.ENCOMENDA;
    const matchesAvail = anyAvail || avail[availabilityOf(p)];
    const matchesVerified = !onlyVerified || isVerified(p);
    const matchesRating = !minRating || (p.rating || 0) >= minRating;
    return matchesSearch && matchesCategory && matchesMin && matchesMax && matchesAvail && matchesVerified && matchesRating;
  });

  const tabCounts = {
    TODOS: base.length,
    STOCK: base.filter((p) => availabilityOf(p) === 'STOCK').length,
    ENCOMENDA: base.filter((p) => availabilityOf(p) === 'ENCOMENDA').length,
    PROMO: base.filter((p) => p.promoPrice != null).length,
  };

  let filtered = base.filter((p) => {
    if (tab === 'STOCK') return availabilityOf(p) === 'STOCK';
    if (tab === 'ENCOMENDA') return availabilityOf(p) === 'ENCOMENDA';
    if (tab === 'PROMO') return p.promoPrice != null;
    return true;
  });

  filtered = [...filtered].sort((a, b) => {
    if (sort === 'price_asc') return priceOf(a) - priceOf(b);
    if (sort === 'price_desc') return priceOf(b) - priceOf(a);
    if (sort === 'rating') return (b.rating || 0) - (a.rating || 0);
    if (sort === 'recent') return new Date(b.createdAt) - new Date(a.createdAt);
    return (b.rating || 0) * (b.reviewCount || 0) - (a.rating || 0) * (a.reviewCount || 0); // relevância
  });

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pages);
  const start = (current - 1) * pageSize;
  const shown = filtered.slice(start, start + pageSize);

  const handleAdd = (p) => { addItem(p, 1); setAdded(p.id); setTimeout(() => setAdded(null), 1200); };
  const toggleCompare = (id) => setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const clearFilters = () => {
    setSearch(''); setCategory(''); setPriceMin(''); setPriceMax('');
    setAvail({ STOCK: false, ENCOMENDA: false }); setOnlyVerified(false); setMinRating(0); setTab('TODOS');
  };

  const compareItems = products.filter((p) => compare.includes(p.id));

  return (
    <div>
      <Crumbs trail={['Home', 'Produtos / Serviços', 'Produtos']} />
      <PageHead
        title="Produtos"
        actions={(
          <button className="btn btn-ghost btn-sm" disabled={compare.length < 2} onClick={() => setShowCompare(true)}>
            <Icon name="report" size={14} /> {t('Comparar')} ({compare.length})
          </button>
        )}
      />

      <div className="pc-toolbar">
        <div className="pc-search">
          <Icon name="search" size={18} />
          <input
            placeholder={t('Pesquisar produtos por nome, categoria, marca, modelo…')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="pc-layout">
        {/* Painel de filtros */}
        <aside className="pc-aside">
          <div className="pc-filter">
            <h3>{t('Categorias')}</h3>
            <ul className="pc-cats">
              <li className={category === '' ? 'on' : ''} onClick={() => setCategory('')}>
                <span>{t('Todos')}</span><span className="pc-c">{products.length}</span>
              </li>
              {categories.map((c) => (
                <li key={c.name} className={category === c.name ? 'on' : ''} onClick={() => setCategory(category === c.name ? '' : c.name)}>
                  <span>{c.name}</span><span className="pc-c">{c.count}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pc-filter">
            <h3>{t('Faixa de Preço')} (Kz)</h3>
            <div className="pc-price">
              <input type="number" min="0" placeholder={t('Mínimo')} value={priceMin} onChange={(e) => setPriceMin(e.target.value)} />
              <input type="number" min="0" placeholder={t('Máximo')} value={priceMax} onChange={(e) => setPriceMax(e.target.value)} />
            </div>
            {priceBounds.max > 0 ? (
              <div className="pc-price-hint">{formatMoney(priceBounds.min)} — {formatMoney(priceBounds.max)}</div>
            ) : null}
          </div>

          <div className="pc-filter">
            <h3>{t('Disponibilidade')}</h3>
            <label className="pc-check">
              <input type="checkbox" checked={avail.STOCK} onChange={(e) => setAvail((a) => ({ ...a, STOCK: e.target.checked }))} />
              <span>{t('Em Stock')}</span><span className="pc-c">{availCounts.STOCK}</span>
            </label>
            <label className="pc-check">
              <input type="checkbox" checked={avail.ENCOMENDA} onChange={(e) => setAvail((a) => ({ ...a, ENCOMENDA: e.target.checked }))} />
              <span>{t('Por Encomenda')}</span><span className="pc-c">{availCounts.ENCOMENDA}</span>
            </label>
          </div>

          <div className="pc-filter">
            <h3>{t('Fornecedor Verificado')}</h3>
            <label className="pc-check">
              <input type="checkbox" checked={onlyVerified} onChange={(e) => setOnlyVerified(e.target.checked)} />
              <span>{t('Apenas Fornecedores Verificados')}</span>
            </label>
          </div>

          <div className="pc-filter">
            <h3>{t('Avaliação do Produto')}</h3>
            {[5, 4, 3, 2, 1].map((n) => (
              <label key={n} className={`pc-check pc-rate${minRating === n ? ' on' : ''}`}>
                <input type="radio" name="rate" checked={minRating === n} onChange={() => setMinRating(minRating === n ? 0 : n)} onClick={() => { if (minRating === n) setMinRating(0); }} />
                <span className="pc-stars"><Stars value={n} /></span>
                <span className="pc-c">{ratingCounts[n]}</span>
              </label>
            ))}
          </div>

          <div className="pc-filter-actions">
            <button className="btn btn-ghost btn-sm" onClick={clearFilters}>{t('Limpar Filtros')}</button>
          </div>
        </aside>

        {/* Conteúdo */}
        <div className="pc-main">
          <div className="pc-resultbar">
            <span className="pc-count">
              {total === 0
                ? t('Nenhum resultado')
                : t('A mostrar {a} - {b} de {n} produtos', { a: start + 1, b: Math.min(start + pageSize, total), n: total })}
            </span>
            <div className="pc-resultbar-right">
              <label className="pc-sort">
                {t('Ordenar por')}
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="rel">{t('Mais Relevantes')}</option>
                  <option value="price_asc">{t('Preço: menor primeiro')}</option>
                  <option value="price_desc">{t('Preço: maior primeiro')}</option>
                  <option value="rating">{t('Melhor Avaliados')}</option>
                  <option value="recent">{t('Mais Recentes')}</option>
                </select>
              </label>
              <div className="pc-viewtoggle">
                <button className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')} aria-label={t('Grelha')}><Icon name="catalog" size={16} /></button>
                <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')} aria-label={t('Lista')}><Icon name="report" size={16} /></button>
              </div>
            </div>
          </div>

          <div className="pc-tabs">
            {[['TODOS', 'Todos'], ['STOCK', 'Em Stock'], ['ENCOMENDA', 'Por Encomenda'], ['PROMO', 'Promoções']].map(([key, label]) => (
              <button key={key} className={`pc-tab${tab === key ? ' on' : ''}`} onClick={() => setTab(key)}>
                {t(label)}<span className="pc-tab-count">{tabCounts[key === 'TODOS' ? 'TODOS' : key]}</span>
              </button>
            ))}
          </div>

          {total === 0 ? (
            <div className="empty-state">
              <h3>{t('Nenhum item encontrado')}</h3>
              <p>{t('Ajuste a pesquisa ou os filtros.')}</p>
            </div>
          ) : (
            <div className={view === 'grid' ? 'pc-grid' : 'pc-grid pc-grid-list'}>
              {shown.map((p) => {
                const av = availabilityOf(p);
                const unit = p.measurementUnit ? ` / ${p.measurementUnit}` : '';
                return (
                  <div key={p.id} className="pc-card">
                    <div className="pc-cover">
                      <span className={`pc-avail ${av === 'STOCK' ? 'stock' : 'enc'}`}>{av === 'STOCK' ? t('Em Stock') : t('Por Encomenda')}</span>
                      <button className={`pc-fav${compare.includes(p.id) ? ' on' : ''}`} onClick={() => toggleCompare(p.id)} aria-label={t('Comparar')} title={t('Adicionar à comparação')}>
                        <Icon name="report" size={15} />
                      </button>
                      <Link to={`/comprador/catalogo/${p.id}`}><ProductCover imageUrl={p.imageUrl} category={p.category} name={p.name} caption={false} /></Link>
                    </div>
                    <div className="pc-body">
                      <Link to={`/comprador/catalogo/${p.id}`} className="pc-name">{p.name}</Link>
                      {p.brand ? <div className="pc-brand">{p.brand}</div> : null}
                      {p.rating ? (
                        <div className="pc-rate"><Stars value={p.rating} /> <strong>{p.rating.toFixed(1)}</strong> <span>({p.reviewCount} {t('avaliações')})</span></div>
                      ) : <div className="pc-rate pc-rate-empty">{t('Sem avaliações')}</div>}
                      <div className="pc-sup">
                        <span className="pc-sup-label">{t('Fornecedor')}</span>
                        <span className="pc-sup-name">{p.supplier?.name || '—'}</span>
                        {isVerified(p) ? <span className="pc-verif"><Icon name="approvals" size={12} /> {t('Verificado')}</span> : null}
                      </div>
                      <div className="pc-price-row">
                        {p.promoPrice != null ? <span className="pc-old">{formatMoney(p.unitPrice, p.currency)}</span> : null}
                        <span className="pc-price">{formatMoney(p.promoPrice ?? p.unitPrice, p.currency)}{unit}</span>
                      </div>
                      <div className="pc-actions">
                        <button className="btn btn-primary btn-sm pc-add" onClick={() => handleAdd(p)}>
                          {added === p.id ? t('Adicionado ✓') : t('Adicionar à Cesta')}
                        </button>
                        <button className={`pc-cmp${compare.includes(p.id) ? ' on' : ''}`} onClick={() => toggleCompare(p.id)} aria-label={t('Comparar')} title={t('Comparar')}>
                          <Icon name="report" size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {total > 0 ? (
            <div className="pc-pagination">
              <button className="pc-pg" disabled={current === 1} onClick={() => setPage(current - 1)}>← {t('Anterior')}</button>
              <span className="pc-pg-info">{t('Página {a} de {b}', { a: current, b: pages })}</span>
              <button className="pc-pg" disabled={current === pages} onClick={() => setPage(current + 1)}>{t('Próximo')} →</button>
              <label className="pc-pagesize">
                {t('Produtos por página')}
                <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                  {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            </div>
          ) : null}
        </div>
      </div>

      {showCompare && compareItems.length ? (
        <div className="pc-modal" onClick={() => setShowCompare(false)}>
          <div className="pc-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="pc-modal-head">
              <h3>{t('Comparar Produtos')} ({compareItems.length})</h3>
              <button className="pc-modal-x" onClick={() => setShowCompare(false)}>✕</button>
            </div>
            <div className="pc-compare">
              <table className="bz-table">
                <thead>
                  <tr>
                    <th>{t('Produto')}</th>
                    {compareItems.map((p) => <th key={p.id}>{p.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  <tr><td>{t('Fornecedor')}</td>{compareItems.map((p) => <td key={p.id}>{p.supplier?.name || '—'}</td>)}</tr>
                  <tr><td>{t('Categoria')}</td>{compareItems.map((p) => <td key={p.id}>{p.category}</td>)}</tr>
                  <tr><td>{t('Marca')}</td>{compareItems.map((p) => <td key={p.id}>{p.brand || '—'}</td>)}</tr>
                  <tr><td>{t('Preço')}</td>{compareItems.map((p) => <td key={p.id}>{formatMoney(p.promoPrice ?? p.unitPrice, p.currency)}</td>)}</tr>
                  <tr><td>{t('Avaliação')}</td>{compareItems.map((p) => <td key={p.id}>{p.rating ? `${p.rating.toFixed(1)} (${p.reviewCount})` : '—'}</td>)}</tr>
                  <tr><td>{t('Disponibilidade')}</td>{compareItems.map((p) => <td key={p.id}>{availabilityOf(p) === 'STOCK' ? t('Em Stock') : t('Por Encomenda')}</td>)}</tr>
                  <tr><td>{t('Prazo de Entrega')}</td>{compareItems.map((p) => <td key={p.id}>{p.leadTimeDays != null ? `${p.leadTimeDays} ${t('dias')}` : '—'}</td>)}</tr>
                </tbody>
              </table>
            </div>
            <div className="pc-modal-foot">
              <button className="btn btn-ghost btn-sm" onClick={() => { setCompare([]); setShowCompare(false); }}>{t('Limpar comparação')}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
