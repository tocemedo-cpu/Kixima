// src/pages/comprador/Catalog.jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { PageHeader, Loading, ErrorBanner } from '../../components/Common';
import { formatMoney } from '../../domain';
import { useCart } from './CartContext';

export default function Catalog() {
  const [products, setProducts] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [added, setAdded] = useState(null);
  const { addItem } = useCart();

  useEffect(() => {
    api.get('/api/catalog').then(setProducts).catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorBanner message={error} />;
  if (!products) return <Loading />;

  const filtered = products.filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase())
  );

  function handleAdd(product) {
    addItem(product, 1);
    setAdded(product.id);
    setTimeout(() => setAdded(null), 1200);
  }

  return (
    <div>
      <PageHeader title="Catálogo" subtitle="Pesquise e filtre produtos e serviços de fornecedores credenciados." />

      <div className="field" style={{ maxWidth: 360, marginBottom: 20 }}>
        <input placeholder="Pesquisar por nome ou categoria…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <h3>Nenhum item encontrado</h3>
          <p>Tente outro termo de pesquisa.</p>
        </div>
      ) : (
        <div className="grid-cols grid-3">
          {filtered.map((p) => (
            <div key={p.id} className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <span className="badge badge-neutral">{p.category}</span>
              </div>
              <Link to={`/comprador/catalogo/${p.id}`} style={{ fontSize: 15, fontWeight: 600, color: 'var(--navy-900)', textDecoration: 'none' }}>
                {p.name}
              </Link>
              <p style={{ fontSize: 13, color: 'var(--ink-600)', flex: 1 }}>{p.description}</p>
              <div style={{ fontSize: 12, color: 'var(--ink-400)' }}>{p.supplier?.name}</div>
              {p.leadTimeDays ? <div style={{ fontSize: 12, color: 'var(--ink-400)' }}>Prazo: {p.leadTimeDays} dias</div> : null}
              <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--navy-900)' }}>
                {formatMoney(p.unitPrice, p.currency)}
              </strong>
              <button className="btn btn-primary btn-sm" onClick={() => handleAdd(p)}>
                {added === p.id ? 'Adicionado ✓' : 'Adicionar à cesta'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
