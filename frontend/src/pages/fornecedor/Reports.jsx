// src/pages/fornecedor/Reports.jsx
// Relatórios → Estatísticas. Agregados reais do fornecedor: catálogo, ordens
// recebidas por estado, receita reconhecida e produtos mais vendidos.
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { PageHeader, Loading, ErrorBanner, StatCard } from '../../components/Common';
import Badge from '../../components/Badge';
import { PO_STATUS, formatMoney } from '../../domain';

export default function Reports() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/reports/fornecedor').then(setStats).catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorBanner message={error} />;
  if (!stats) return <Loading />;

  const statusRows = Object.entries(stats.statusCounts || {}).sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <PageHeader title="Relatórios — Estatísticas" subtitle="Desempenho do seu catálogo e das ordens recebidas." />

      <div className="grid-cols grid-3" style={{ marginBottom: 18 }}>
        <StatCard label="Receita reconhecida" value={formatMoney(stats.revenue)} sub="Ordens já pagas" />
        <StatCard label="Ordens recebidas" value={stats.totalOrders} />
        <StatCard label="Produtos ativos" value={stats.activeProducts} sub={`${stats.totalProducts} no total`} />
      </div>
      <div className="grid-cols grid-3" style={{ marginBottom: 18 }}>
        <StatCard label="Abaixo do estoque mínimo" value={stats.lowStock} sub={stats.lowStock ? 'Requer reposição' : 'Tudo acima do mínimo'} />
      </div>

      <div className="grid-cols grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-pad" style={{ borderBottom: '1px solid var(--line)' }}><strong>Ordens por estado</strong></div>
          {statusRows.length === 0 ? (
            <div className="card-pad"><p className="helptext" style={{ margin: 0 }}>Ainda sem ordens recebidas.</p></div>
          ) : (
            <table>
              <tbody>
                {statusRows.map(([status, count]) => (
                  <tr key={status}>
                    <td><Badge tone={PO_STATUS[status]?.tone}>{PO_STATUS[status]?.label || status}</Badge></td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div className="card-pad" style={{ borderBottom: '1px solid var(--line)' }}><strong>Produtos mais vendidos</strong></div>
          {(!stats.topProducts || stats.topProducts.length === 0) ? (
            <div className="card-pad"><p className="helptext" style={{ margin: 0 }}>Sem vendas registadas ainda.</p></div>
          ) : (
            <table>
              <thead>
                <tr><th>Produto</th><th style={{ textAlign: 'right' }}>Qtd.</th><th style={{ textAlign: 'right' }}>Total</th></tr>
              </thead>
              <tbody>
                {stats.topProducts.map((p) => (
                  <tr key={p.productId}>
                    <td>{p.name}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{p.quantity}</td>
                    <td style={{ textAlign: 'right' }}>{formatMoney(p.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
