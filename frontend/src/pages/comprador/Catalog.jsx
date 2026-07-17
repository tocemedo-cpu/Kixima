// src/pages/comprador/Catalog.jsx
// Marketplace do Comprador — cartões visuais com reputação (Direção 01) e
// tiles de categoria + selos de confiança do setor Oil & Gas (Direção 05).
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { PageHeader, Loading, ErrorBanner } from '../../components/Common';
import { formatMoney } from '../../domain';
import { useCart } from './CartContext';
import { Icon, Stars, categoryVisual } from '../../components/icons';

export default function Catalog() {
  const [products, setProducts] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [added, setAdded] = useState(null);
  const { addItem } = useCart();

  useEffect(() => {
    api.get('/api/catalog').then(setProducts).catch((e) => setError(e.message));
  }, []);

  const categories = useMemo(() => {
    if (!products) return [];
    const map = new Map();
    products.forEach((p) => map.set(p.category, (map.get(p.category) || 0) + 1));
    return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [products]);

  if (error) return <ErrorBanner message={error} />;
  if (!products) return <Loading />;

  const filtered = products.filter((p) => {
    const matchesSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !category || p.category === category;
    return matchesSearch && matchesCategory;
  });

  function handleAdd(product) {
    addItem(product, 1);
    setAdded(product.id);
    setTimeout(() => setAdded(null), 1200);
  }

  return (
    <div>
      <PageHeader
        title="Marketplace"
        subtitle="Produtos e serviços de fornecedores credenciados para a indústria petrolífera."
      />

      <div className="market-search">
        <Icon name="search" size={18} />
        <input
          placeholder="Pesquisar produtos, serviços ou categorias…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="market-count">{filtered.length} de {products.length}</span>
      </div>

      <div className="trust-row">
        <span className="trust-badge"><Icon name="certification" size={13} /> ISO 9001</span>
        <span className="trust-badge"><Icon name="policy" size={13} /> Procurement Garantido</span>
        <span className="trust-badge"><Icon name="approvals" size={13} /> Fornecedores Verificados</span>
      </div>

      <div className="cat-tiles">
        <div
          className={`cat-tile${category === '' ? ' active' : ''}`}
          onClick={() => setCategory('')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setCategory('')}
        >
          <span className="cat-tile-ic" style={{ background: 'linear-gradient(135deg,#e11d2a,#f5327c)' }}>
            <Icon name="catalog" size={22} />
          </span>
          <span className="cat-tile-name">Todos</span>
          <span className="cat-tile-count">{products.length}</span>
        </div>
        {categories.map((c) => {
          const vis = categoryVisual(c.name);
          return (
            <div
              key={c.name}
              className={`cat-tile${category === c.name ? ' active' : ''}`}
              onClick={() => setCategory(category === c.name ? '' : c.name)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setCategory(category === c.name ? '' : c.name)}
            >
              <span className="cat-tile-ic" style={{ background: `linear-gradient(135deg, ${vis.from}, ${vis.to})` }}>
                <Icon name={vis.icon} size={22} />
              </span>
              <span className="cat-tile-name">{c.name}</span>
              <span className="cat-tile-count">{c.count}</span>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <h3>Nenhum item encontrado</h3>
          <p>Tente outro termo de pesquisa ou limpe o filtro de categoria.</p>
        </div>
      ) : (
        <div className="mk-grid">
          {filtered.map((p) => {
            const vis = categoryVisual(p.category);
            const verified = p.supplier?.status === 'APROVADA';
            return (
              <div key={p.id} className="mk-card">
                <div className="mk-cover" style={{ background: `radial-gradient(120% 120% at 30% 20%, ${vis.from}, ${vis.to})` }}>
                  <span className={`mk-avail ${p.active ? 'on' : 'off'}`}>{p.active ? 'Disponível' : 'Sob Consulta'}</span>
                  <Icon name={vis.icon} size={72} />
                </div>
                <div className="mk-body">
                  <div className="mk-supplier"><span className="mk-logo" />{p.supplier?.name || 'Fornecedor'}</div>
                  <Link to={`/comprador/catalogo/${p.id}`} className="mk-title">{p.name}</Link>
                  {p.rating ? (
                    <div className="mk-rate">
                      <Stars value={p.rating} /> {p.rating.toFixed(1)}
                      <span style={{ color: 'var(--ink-400)' }}>· {p.reviewCount} avaliações</span>
                      {verified ? <span className="mk-verif">· <Icon name="approvals" size={12} /> Verificado</span> : null}
                    </div>
                  ) : (
                    verified ? <div className="mk-rate"><span className="mk-verif"><Icon name="approvals" size={12} /> Fornecedor Verificado</span></div> : null
                  )}
                  <p className="mk-desc">{p.description}</p>
                  <div className="mk-meta">
                    <span className="mk-price">{formatMoney(p.unitPrice, p.currency)}</span>
                    {p.leadTimeDays ? <span className="mk-lead">Prazo {p.leadTimeDays} dias</span> : null}
                  </div>
                  <div className="mk-actions">
                    <Link to={`/comprador/catalogo/${p.id}`} className="btn btn-ghost btn-sm">Ver Detalhes</Link>
                    <button className="btn btn-primary btn-sm" onClick={() => handleAdd(p)}>
                      {added === p.id ? 'Adicionado ✓' : 'Adicionar à cesta'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
