// src/pages/fornecedor/CatalogInsights.jsx
// Vistas do catálogo derivadas dos produtos da própria empresa (agrega o
// resultado de /api/catalog). Um só componente serve Categorias, Marcas,
// Serviços, Promoções (Catálogo) e Armazéns (Inventário) — conforme a rota.
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../api/client';
import { PageHeader, Loading, ErrorBanner } from '../../components/Common';
import { formatMoney } from '../../domain';

// Categorias tratadas como "serviço" (não têm stock físico).
const SERVICE_CATEGORIES = new Set([
  'Consultoria', 'Engenharia', 'Inspeção & Ensaios', 'Formação & Certificação', 'Logística & Transporte',
]);

const TITLES = {
  categorias: 'Categorias', marcas: 'Marcas', servicos: 'Serviços', promocoes: 'Promoções', armazens: 'Armazéns',
};

export default function CatalogInsights() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const seg = pathname.split('/').filter(Boolean).pop();
  const [products, setProducts] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/catalog', { supplierId: user.companyId }).then(setProducts).catch((e) => setError(e.message));
  }, [user.companyId]);

  const grouped = useMemo(() => {
    if (!products) return null;
    const byKey = (fn) => {
      const m = new Map();
      for (const p of products) {
        const k = fn(p);
        if (!k) continue;
        const cur = m.get(k) || { key: k, count: 0, units: 0 };
        cur.count += 1;
        cur.units += p.stockQuantity || 0;
        m.set(k, cur);
      }
      return [...m.values()].sort((a, b) => b.count - a.count);
    };
    return {
      categorias: byKey((p) => p.category),
      marcas: byKey((p) => p.brand),
      armazens: byKey((p) => p.warehouse),
      servicos: products.filter((p) => SERVICE_CATEGORIES.has(p.category)),
      promocoes: products.filter((p) => p.promoPrice != null && Number(p.promoPrice) > 0),
    };
  }, [products]);

  if (error) return <ErrorBanner message={error} />;
  if (!products || !grouped) return <Loading />;

  const title = TITLES[seg] || 'Catálogo';

  return (
    <div>
      <PageHeader title={title} subtitle="Baseado nos produtos publicados pela sua empresa." />
      {renderView(seg, grouped, title)}
    </div>
  );
}

function renderView(seg, g, title) {
  if (seg === 'servicos' || seg === 'promocoes') {
    const rows = g[seg];
    if (rows.length === 0) return <Empty label={title} />;
    return (
      <div className="card" style={{ overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Produto</th><th>Categoria</th><th style={{ textAlign: 'right' }}>Preço</th></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td><strong>{p.name}</strong></td>
                <td>{p.subcategory ? `${p.category} · ${p.subcategory}` : p.category}</td>
                <td style={{ textAlign: 'right' }}>
                  {seg === 'promocoes' && p.promoPrice ? (
                    <>
                      <span style={{ color: 'var(--brand-600)', fontWeight: 700 }}>{formatMoney(p.promoPrice, p.currency)}</span>{' '}
                      <span style={{ color: 'var(--ink-400)', textDecoration: 'line-through', fontSize: 12 }}>{formatMoney(p.unitPrice, p.currency)}</span>
                    </>
                  ) : formatMoney(p.unitPrice, p.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // categorias / marcas / armazens — agregações com contagem
  const rows = g[seg] || [];
  if (rows.length === 0) return <Empty label={title} />;
  const showUnits = seg === 'armazens';
  return (
    <div className="grid-cols grid-3">
      {rows.map((r) => (
        <div key={r.key} className="card stat-card">
          <div className="stat-label">{r.key}</div>
          <div className="stat-value">{r.count}</div>
          <div className="stat-sub">{r.count === 1 ? 'produto' : 'produtos'}{showUnits ? ` · ${r.units} un. em stock` : ''}</div>
        </div>
      ))}
    </div>
  );
}

function Empty({ label }) {
  return (
    <div className="empty-state">
      <h3>Sem {label.toLowerCase()}</h3>
      <p>Esta vista preenche-se automaticamente à medida que publica produtos com estes dados.</p>
    </div>
  );
}
