// src/pages/fornecedor/Reports.jsx
// Relatórios → Estatísticas. Painel de visão geral (KPIs + ordens por estado).
// Os rankings de produtos vivem em telas próprias (mais vendidos / mais vistos).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { PageHeader, Loading, ErrorBanner, StatCard } from '../../components/Common';
import Badge from '../../components/Badge';
import { PO_STATUS, formatMoney } from '../../domain';
import { useI18n } from '../../i18n';

export default function Reports() {
  const { t } = useI18n();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/reports/fornecedor').then(setStats).catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorBanner message={error} />;
  if (!stats) return <Loading />;

  const statusRows = Object.entries(stats.statusCounts || {}).sort((a, b) => b[1] - a[1]);
  const totalOrders = stats.totalOrders || 0;

  return (
    <div>
      <PageHeader title="Relatórios — Estatísticas" subtitle="Visão geral do desempenho da sua empresa na plataforma." />

      <div className="grid-cols grid-3" style={{ marginBottom: 16 }}>
        <StatCard label="Receita reconhecida" value={formatMoney(stats.revenue)} sub="Ordens já pagas" />
        <StatCard label="Ordens recebidas" value={stats.totalOrders} />
        <StatCard label="Visualizações de produtos" value={stats.totalViews || 0} />
      </div>
      <div className="grid-cols grid-3" style={{ marginBottom: 18 }}>
        <StatCard label="Produtos ativos" value={stats.activeProducts} sub={`${stats.totalProducts} no total`} />
        <StatCard label="Abaixo do estoque mínimo" value={stats.lowStock} sub={stats.lowStock ? 'Requer reposição' : 'Tudo acima do mínimo'} />
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-pad" style={{ borderBottom: '1px solid var(--line)' }}><strong>{t('Ordens por estado')}</strong></div>
        {statusRows.length === 0 ? (
          <div className="card-pad"><p className="helptext" style={{ margin: 0 }}>{t('Ainda sem ordens recebidas.')}</p></div>
        ) : (
          <div className="card-pad" style={{ display: 'grid', gap: 10 }}>
            {statusRows.map(([status, count]) => (
              <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 190 }}><Badge tone={PO_STATUS[status]?.tone}>{PO_STATUS[status]?.label || status}</Badge></div>
                <div style={{ flex: 1, background: 'var(--paper-100)', borderRadius: 999, height: 10, overflow: 'hidden' }}>
                  <div style={{ width: `${totalOrders ? (count / totalOrders) * 100 : 0}%`, height: '100%', background: 'var(--brand-grad)' }} />
                </div>
                <div style={{ width: 32, textAlign: 'right', fontWeight: 700 }}>{count}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="helptext">
        {t('Veja os rankings de produtos em')}{' '}
        <Link to="/fornecedor/relatorios/mais-vendidos" style={{ color: 'var(--brand-600)', fontWeight: 600 }}>{t('Produtos mais vendidos')}</Link>{' '}
        {t('e')}{' '}
        <Link to="/fornecedor/relatorios/mais-vistos" style={{ color: 'var(--brand-600)', fontWeight: 600 }}>{t('Produtos mais vistos')}</Link>.
      </p>
    </div>
  );
}
