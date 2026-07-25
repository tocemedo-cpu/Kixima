// src/pages/companyAdmin/Reports.jsx
// Relatórios — indicadores da empresa e relatórios disponíveis, gerados a
// partir de dados reais (POs, faturas, contratos). Ligado a /api/company-admin/reports.
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { Crumbs, PageHead, KpiRow, EmptyRow, Pill } from '../../components/BuyerUI';
import { Icon } from '../../components/icons';
import { formatMoney } from '../../domain';

export default function Reports() {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.get('/api/company-admin/reports').then(setD).catch((e) => setError(e.message)); }, []);

  if (error) return <div className="empty-state"><h3>Não foi possível carregar</h3><p>{error}</p></div>;
  if (!d) return <div className="bz-empty">A carregar…</div>;
  const max = Math.max(1, ...d.series.map((s) => Math.max(s.receitas, s.despesas)));

  return (
    <div>
      <Crumbs trail={['Relatórios']} />
      <PageHead title="Relatórios" subtitle="Gere análises e relatórios completos sobre as operações da sua empresa." />

      <KpiRow cards={[
        { icon: 'report', tone: 'info', label: 'Relatórios Disponíveis', value: d.kpis.gerados, sub: 'Tipos' },
        { icon: 'orders', tone: 'pending', label: 'Ordens no Período', value: d.kpis.ordens, sub: 'Total' },
        { icon: 'contract', tone: 'success', label: 'Contratos', value: d.kpis.contratos, sub: 'Da empresa' },
        { icon: 'payment', tone: 'neutral', label: 'Faturado', value: formatMoney(d.kpis.faturado), sub: 'Pago' },
      ]} />

      <div className="bz-layout">
        <div className="bz-panel">
          <div className="bz-head" style={{ marginBottom: 10 }}><h3 style={{ margin: 0 }}>Visão Geral de Indicadores</h3><span className="bz-muted">Últimos 6 meses</span></div>
          <div className="rp-legend"><span><i style={{ background: '#16a066' }} /> Receitas</span><span><i style={{ background: '#d94f4f' }} /> Despesas</span></div>
          <div className="ca-bars">
            {d.series.map((s) => (
              <div className="ca-bar" key={s.label}>
                <div className="rp-barpair">
                  <div className="ca-bar-track"><div className="ca-bar-fill" style={{ height: `${Math.round((s.receitas / max) * 100)}%`, background: '#16a066' }} title={`Receitas ${formatMoney(s.receitas)}`} /></div>
                  <div className="ca-bar-track"><div className="ca-bar-fill" style={{ height: `${Math.round((s.despesas / max) * 100)}%`, background: '#d94f4f' }} title={`Despesas ${formatMoney(s.despesas)}`} /></div>
                </div>
                <span className="bz-muted">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bz-side">
          <div className="bz-panel">
            <h3>Relatórios Disponíveis</h3>
            {d.catalog.map((r) => (
              <div className="hs-ticket" key={r.key}>
                <div><strong>{r.name}</strong><span className="bz-sub2">{r.desc}</span></div>
                <div className="hs-ticket-meta"><Pill tone="neutral">{r.module}</Pill><button className="btn btn-ghost btn-sm"><Icon name="report" size={13} /> {r.format}</button></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
