// src/pages/companyAdmin/Contracts.jsx
// Contratos — contratos-quadro (call-off) da empresa, ligados a /api/contracts.
// KPIs, tabela e resumo por estado. Estética do mockup.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../api/client';
import { Crumbs, PageHead, KpiRow, Pill, Toolbar, EmptyRow } from '../../components/BuyerUI';
import { CONTRACT_STATUS, BILLING_PERIODICITY, formatMoney, formatDate } from '../../domain';
import { useI18n } from '../../i18n';

export default function Contracts() {
  const { t } = useI18n();
  const nav = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { api.get('/api/contracts').then(setRows).catch((e) => setError(e.message)); }, []);

  const counterpart = (c) => (c.clientCompanyId === user.companyId ? c.supplierCompany : c.clientCompany);
  const in30 = Date.now() + 30 * 864e5;

  const kpis = useMemo(() => {
    const r = rows || [];
    return {
      total: r.length,
      ativos: r.filter((c) => c.status === 'ATIVO').length,
      aVencer: r.filter((c) => c.status === 'ATIVO' && new Date(c.validUntil).getTime() <= in30).length,
      vencidos: r.filter((c) => c.status === 'EXPIRADO').length,
      valor: r.reduce((s, c) => s + Number(c.totalValue || 0), 0),
    };
  }, [rows]);

  const list = (rows || []).filter((c) => !q || c.reference.toLowerCase().includes(q.toLowerCase()) || counterpart(c)?.name?.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <Crumbs trail={['Contratos']} />
      <PageHead title="Contratos" subtitle="Gerencie todos os contratos ativos e históricos da sua empresa." />

      <KpiRow cards={[
        { icon: 'contract', tone: 'info', label: 'Total de Contratos', value: kpis.total, sub: 'Todos os contratos' },
        { icon: 'certification', tone: 'success', label: 'Ativos', value: kpis.ativos, sub: 'Contratos ativos' },
        { icon: 'history', tone: 'pending', label: 'A Vencer (30 dias)', value: kpis.aVencer, sub: 'Próximos do vencimento' },
        { icon: 'approvals', tone: 'danger', label: 'Vencidos', value: kpis.vencidos, sub: 'Contratos vencidos' },
        { icon: 'payment', tone: 'neutral', label: 'Valor Total', value: formatMoney(kpis.valor), sub: 'Valor dos contratos' },
      ]} />

      <div className="bz-layout">
        <div>
          <Toolbar placeholder="Buscar por contrato, cliente ou projeto…" q={q} onQ={setQ} />
          {error ? <div className="empty-state"><p>{error}</p></div> : (
            <div className="bz-card bz-tablewrap">
              <table className="bz-table">
                <thead><tr><th>{t('Nº do Contrato')}</th><th>{t('Contraparte')}</th><th>{t('Âmbito')}</th><th className="r">{t('Valor')}</th><th>{t('Vigência')}</th><th>{t('Periodicidade')}</th><th>{t('Status')}</th></tr></thead>
                <tbody>
                  {!rows ? <tr><td colSpan={7}><EmptyRow>A carregar…</EmptyRow></td></tr>
                    : list.length === 0 ? <tr><td colSpan={7}><EmptyRow>Sem contratos.</EmptyRow></td></tr>
                    : list.map((c) => (
                      <tr key={c.id}>
                        <td><span className="bz-mono">{c.reference}</span></td>
                        <td>{counterpart(c)?.name || '—'}</td>
                        <td>{(c.categoriesCovered || []).join(', ') || '—'}</td>
                        <td className="r"><strong>{formatMoney(c.totalValue, c.currency)}</strong><span className="bz-sub2">usado {formatMoney(c.usedValue, c.currency)}</span></td>
                        <td>{formatDate(c.validFrom)}<span className="bz-sub2">até {formatDate(c.validUntil)}</span></td>
                        <td>{BILLING_PERIODICITY[c.billingPeriodicity] || c.billingPeriodicity}</td>
                        <td><Pill tone={CONTRACT_STATUS[c.status]?.tone}>{CONTRACT_STATUS[c.status]?.label || c.status}</Pill></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bz-side">
          <div className="bz-panel">
            <h3>{t('Resumo por Status')}</h3>
            <div className="bz-panel-row"><span>Ativos</span><strong style={{ color: '#16884f' }}>{kpis.ativos}</strong></div>
            <div className="bz-panel-row"><span>A Vencer</span><strong style={{ color: '#b9740f' }}>{kpis.aVencer}</strong></div>
            <div className="bz-panel-row"><span>Vencidos</span><strong style={{ color: '#c0392b' }}>{kpis.vencidos}</strong></div>
          </div>
          <div className="bz-panel">
            <h3>{t('Próximos a Vencer')}</h3>
            {(rows || []).filter((c) => c.status === 'ATIVO').sort((a, b) => new Date(a.validUntil) - new Date(b.validUntil)).slice(0, 5).map((c) => (
              <div className="bz-panel-row" key={c.id}><span className="bz-mono">{c.reference}</span><span className="bz-sub2">{formatDate(c.validUntil)}</span></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
