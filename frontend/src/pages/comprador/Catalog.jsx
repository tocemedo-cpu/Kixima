// src/pages/comprador/Catalog.jsx
// Produtos (Comprador) — catálogo com filtros (categorias, faixa de preço,
// fornecedor verificado, avaliação), separadores (Todos/Promoções), ordenação,
// comparação e PAGINAÇÃO NO SERVIDOR. Os dados vêm de /api/marketplace/search
// (itens paginados) e /api/marketplace/facets (contagens por categoria e limites
// de preço) — filtrados no backend, escala para milhares de produtos.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { ErrorBanner } from '../../components/Common';
import { formatMoney } from '../../domain';
import { useCart } from './CartContext';
import { Icon, Stars } from '../../components/icons';
import ProductCover from '../../components/ProductCover';
import { Crumbs, PageHead } from '../../components/BuyerUI';
import { useI18n } from '../../i18n';

const PAGE_SIZES = [16, 24, 48];
const SORT_MAP = { rel: 'relevantes', price_asc: 'preco_asc', price_desc: 'preco_desc', rating: 'avaliacao', recent: 'recentes' };

// Classifica a disponibilidade real do produto (etiqueta por item no cartão).
function availabilityOf(p) {
  const a = (p.availability || '').toLowerCase();
  if (a.includes('encomenda') || a.includes('sob')) return 'ENCOMENDA';
  return 'STOCK';
}

export default function Catalog() {
  const { t } = useI18n();
  const { addItem } = useCart();
  const [error, setError] = useState('');

  // Filtros
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [tab, setTab] = useState('TODOS');
  const [sort, setSort] = useState('rel');
  const [view, setView] = useState('grid');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(16);

  // Dados do servidor
  const [data, setData] = useState(null); // { items, total, page, pages }
  const [facets, setFacets] = useState({ categories: [], priceBounds: { min: 0, max: 0 } });

  const [added, setAdded] = useState(null);
  const [compare, setCompare] = useState([]); // produtos selecionados (persiste entre páginas)
  const [showCompare, setShowCompare] = useState(false);

  // Parâmetros de filtro (sem página/ordenação) — partilhados por search e facets.
  const filterParams = useMemo(() => {
    const p = { kind: 'PRODUTO' };
    if (search.trim()) p.q = search.trim();
    if (category) p.category = category;
    if (priceMin) p.minPrice = priceMin;
    if (priceMax) p.maxPrice = priceMax;
    if (onlyVerified) p.verified = 'true';
    if (minRating) p.minRating = minRating;
    if (tab === 'PROMO') p.promo = 'true';
    return p;
  }, [search, category, priceMin, priceMax, onlyVerified, minRating, tab]);

  // Ao mudar de filtro/ordenação/tamanho, volta à 1ª página.
  useEffect(() => { setPage(1); }, [filterParams, sort, pageSize]);

  // Itens paginados.
  useEffect(() => {
    setError('');
    api.get('/api/marketplace/search', { ...filterParams, sort: SORT_MAP[sort], page, limit: pageSize })
      .then(setData).catch((e) => setError(e.message));
  }, [filterParams, sort, page, pageSize]);

  // Facetas (contagens por categoria + limites de preço).
  useEffect(() => {
    api.get('/api/marketplace/facets', filterParams).then(setFacets).catch(() => {});
  }, [filterParams]);

  const priceOf = (p) => Number(p.promoPrice ?? p.unitPrice) || 0;
  const isVerified = (p) => p.supplier?.verified || p.supplier?.status === 'APROVADA';
  // Selo do plano Pro. É a contrapartida visível de "Destaque + selo" na tabela
  // de preços — sem isto, o fornecedor paga o Pro e não vê diferença nenhuma
  // além de uma posição que ele próprio não consegue confirmar.
  const isDestaque = (p) => (p.supplier?.searchRank ?? 0) >= 2;
  const handleAdd = (p) => { addItem(p, 1); setAdded(p.id); setTimeout(() => setAdded(null), 1200); };
  const toggleCompare = (p) => setCompare((c) => (c.some((x) => x.id === p.id) ? c.filter((x) => x.id !== p.id) : [...c, p]));
  const inCompare = (id) => compare.some((x) => x.id === id);
  const clearFilters = () => {
    setSearch(''); setCategory(''); setPriceMin(''); setPriceMax('');
    setOnlyVerified(false); setMinRating(0); setTab('TODOS');
  };

  if (error) return <ErrorBanner message={error} />;

  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;
  const current = data?.page ?? 1;
  const start = (current - 1) * pageSize;
  const items = data?.items || [];
  const totalAll = facets.categories.reduce((s, c) => s + c.count, 0);
  const bounds = facets.priceBounds || { min: 0, max: 0 };

  return (
    <div>
      <Crumbs trail={['Home', 'Catálogo', 'Produtos']} />
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
                <span>{t('Todos')}</span><span className="pc-c">{totalAll}</span>
              </li>
              {facets.categories.map((c) => (
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
            {bounds.max > 0 ? (
              <div className="pc-price-hint">{formatMoney(bounds.min)} — {formatMoney(bounds.max)}</div>
            ) : null}
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
                <span className="pc-c">{n === 5 ? '' : '+'}</span>
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
              {!data ? t('A carregar…') : total === 0
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
            {[['TODOS', 'Todos'], ['PROMO', 'Promoções']].map(([key, label]) => (
              <button key={key} className={`pc-tab${tab === key ? ' on' : ''}`} onClick={() => setTab(key)}>
                {t(label)}
              </button>
            ))}
          </div>

          {!data ? (
            <div className="pc-grid">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="pc-card pc-skel" />)}</div>
          ) : total === 0 ? (
            <div className="empty-state">
              <h3>{t('Nenhum item encontrado')}</h3>
              <p>{t('Ajuste a pesquisa ou os filtros.')}</p>
            </div>
          ) : (
            <div className={view === 'grid' ? 'pc-grid' : 'pc-grid pc-grid-list'}>
              {items.map((p) => {
                const av = availabilityOf(p);
                const unit = p.measurementUnit ? ` / ${p.measurementUnit}` : '';
                return (
                  <div key={p.id} className="pc-card">
                    <div className="pc-cover">
                      <span className={`pc-avail ${av === 'STOCK' ? 'stock' : 'enc'}`}>{av === 'STOCK' ? t('Em Stock') : t('Por Encomenda')}</span>
                      <button className={`pc-fav${inCompare(p.id) ? ' on' : ''}`} onClick={() => toggleCompare(p)} aria-label={t('Comparar')} title={t('Adicionar à comparação')}>
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
                        {isDestaque(p) ? <span className="pc-destaque"><Icon name="policy" size={12} /> {t('Destaque')}</span> : null}
                      </div>
                      <div className="pc-price-row">
                        {p.promoPrice != null ? <span className="pc-old">{formatMoney(p.unitPrice, p.currency)}</span> : null}
                        <span className="pc-price">{formatMoney(p.promoPrice ?? p.unitPrice, p.currency)}{unit}</span>
                      </div>
                      <div className="pc-actions">
                        <button className="btn btn-primary btn-sm pc-add" onClick={() => handleAdd(p)}>
                          {added === p.id ? t('Adicionado ✓') : t('Adicionar à Cesta')}
                        </button>
                        <button className={`pc-cmp${inCompare(p.id) ? ' on' : ''}`} onClick={() => toggleCompare(p)} aria-label={t('Comparar')} title={t('Comparar')}>
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
              <button className="pc-pg" disabled={current >= pages} onClick={() => setPage(current + 1)}>{t('Próximo')} →</button>
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

      {showCompare && compare.length ? (
        <div className="pc-modal" onClick={() => setShowCompare(false)}>
          <div className="pc-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="pc-modal-head">
              <h3>{t('Comparar Produtos')} ({compare.length})</h3>
              <button className="pc-modal-x" onClick={() => setShowCompare(false)}>✕</button>
            </div>
            <div className="pc-compare">
              <table className="bz-table">
                <thead>
                  <tr>
                    <th>{t('Produto')}</th>
                    {compare.map((p) => <th key={p.id}>{p.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  <tr><td>{t('Fornecedor')}</td>{compare.map((p) => <td key={p.id}>{p.supplier?.name || '—'}</td>)}</tr>
                  <tr><td>{t('Categoria')}</td>{compare.map((p) => <td key={p.id}>{p.category}</td>)}</tr>
                  <tr><td>{t('Marca')}</td>{compare.map((p) => <td key={p.id}>{p.brand || '—'}</td>)}</tr>
                  <tr><td>{t('Preço')}</td>{compare.map((p) => <td key={p.id}>{formatMoney(p.promoPrice ?? p.unitPrice, p.currency)}</td>)}</tr>
                  <tr><td>{t('Avaliação')}</td>{compare.map((p) => <td key={p.id}>{p.rating ? `${p.rating.toFixed(1)} (${p.reviewCount})` : '—'}</td>)}</tr>
                  <tr><td>{t('Disponibilidade')}</td>{compare.map((p) => <td key={p.id}>{availabilityOf(p) === 'STOCK' ? t('Em Stock') : t('Por Encomenda')}</td>)}</tr>
                  <tr><td>{t('Prazo de Entrega')}</td>{compare.map((p) => <td key={p.id}>{p.leadTimeDays != null ? `${p.leadTimeDays} ${t('dias')}` : '—'}</td>)}</tr>
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
