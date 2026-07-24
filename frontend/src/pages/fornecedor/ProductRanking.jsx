// src/pages/fornecedor/ProductRanking.jsx
// Ranking de produtos por rota: "mais vendidos" (por quantidade e receita) ou
// "mais vistos" (por visualizações). Barras horizontais e posição (#).
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../../api/client';
import { PageHeader, Loading, ErrorBanner } from '../../components/Common';
import { formatMoney } from '../../domain';

export default function ProductRanking() {
  const { pathname } = useLocation();
  const isViewed = pathname.endsWith('/mais-vistos');
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/reports/fornecedor').then(setStats).catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorBanner message={error} />;
  if (!stats) return <Loading />;

  const rows = isViewed ? (stats.topViewed || []) : (stats.topProducts || []);
  const metric = isViewed ? (r) => r.views : (r) => r.quantity;
  const max = Math.max(1, ...rows.map(metric));

  return (
    <div>
      <PageHeader
        title={isViewed ? 'Relatórios — Produtos mais vistos' : 'Relatórios — Produtos mais vendidos'}
        subtitle={isViewed ? 'Ranking dos produtos com mais visualizações de compradores.' : 'Ranking dos produtos com mais unidades vendidas.'}
      />

      {rows.length === 0 ? (
        <div className="empty-state">
          <h3>Sem dados ainda</h3>
          <p>{isViewed
            ? 'As visualizações contam quando os compradores abrem a ficha dos seus produtos no marketplace.'
            : 'As vendas contam a partir das ordens de compra recebidas.'}</p>
        </div>
      ) : (
        <div className="card card-pad" style={{ display: 'grid', gap: 14 }}>
          {rows.map((r, i) => {
            const value = metric(r);
            return (
              <div key={r.productId} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="rank-pos">{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 5 }}>
                    <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</strong>
                    <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {isViewed ? `${value} visualizações` : `${value} un.`}
                      {!isViewed && r.total != null ? <span style={{ color: 'var(--ink-400)', fontWeight: 400 }}> · {formatMoney(r.total)}</span> : null}
                    </span>
                  </div>
                  <div style={{ background: 'var(--paper-100)', borderRadius: 999, height: 12, overflow: 'hidden' }}>
                    <div style={{ width: `${(value / max) * 100}%`, height: '100%', background: 'var(--brand-grad)' }} />
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
