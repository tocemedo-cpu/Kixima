// src/pages/comprador/Suppliers.jsx
// Fornecedores (item 10) — diretório de fornecedores com rating, estado de
// homologação e última transação. Ligado a /api/buyer/suppliers.
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { Crumbs, PageHead, KpiRow, Tabs, Pill, Toolbar, SupplierCell, EmptyRow } from '../../components/BuyerUI';
import { Icon, Stars } from '../../components/icons';
import { formatDate } from '../../domain';
import { useI18n } from '../../i18n';

const TABS = [
  { key: '', label: 'Todos' }, { key: 'ATIVOS', label: 'Ativos' },
  { key: 'AVALIACAO', label: 'Em Avaliação' }, { key: 'HOMOLOGADOS', label: 'Homologados' },
];

export default function Suppliers() {
  const { t } = useI18n();
  const [tab, setTab] = useState('');
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    api.get('/api/buyer/suppliers', { status: tab || undefined, q: q || undefined })
      .then(setData).catch((e) => setError(e.message));
  }, [tab, q]);

  const k = data?.kpis;
  const top = (data?.items || []).filter((s) => s.rating).sort((a, b) => b.rating - a.rating).slice(0, 5);

  return (
    <div>
      <Crumbs trail={['Home', 'Fornecedores']} />
      <PageHead title="Fornecedores" subtitle="Gerencie a sua base de fornecedores e acompanhe o seu desempenho." />

      <KpiRow cards={[
        { icon: 'suppliers', tone: 'info', label: 'Total de Fornecedores', value: k?.total ?? '—', sub: 'Cadastrados' },
        { icon: 'building', tone: 'success', label: 'Fornecedores Ativos', value: k?.ativos ?? '—', sub: 'Aprovados' },
        { icon: 'certification', tone: 'info', label: 'Novos Fornecedores', value: k?.novos ?? '—', sub: 'Últimos 30 dias' },
        { icon: 'approvals', tone: 'pending', label: 'Em Avaliação', value: k?.emAvaliacao ?? '—', sub: 'Documentação pendente' },
        { icon: 'shield', tone: 'success', label: 'Homologados', value: k?.homologados ?? '—', sub: 'Aprovados' },
      ]} />

      <div className="bz-layout">
        <div>
          <Tabs tabs={TABS} value={tab} onChange={setTab} />
          <Toolbar placeholder="Pesquisar por nome, categoria, cidade…" q={q} onQ={setQ} />
          {error ? <div className="empty-state"><p>{error}</p></div> : (
            <div className="bz-card bz-tablewrap">
              <table className="bz-table">
                <thead><tr>
                  <th>{t('Fornecedor')}</th><th>{t('Categoria')}</th><th>{t('Cidade / País')}</th><th>{t('Status')}</th>
                  <th>{t('Avaliação')}</th><th>{t('Última Transação')}</th>
                </tr></thead>
                <tbody>
                  {!data ? <tr><td colSpan={6}><EmptyRow>A carregar…</EmptyRow></td></tr>
                    : data.items.length === 0 ? <tr><td colSpan={6}><EmptyRow>Sem fornecedores.</EmptyRow></td></tr>
                    : data.items.map((s) => (
                      <tr key={s.id}>
                        <td><SupplierCell supplier={s} /></td>
                        <td>{s.category}</td>
                        <td>{[s.city, s.country].filter(Boolean).join(', ') || '—'}</td>
                        <td>
                          <Pill tone={s.status === 'APROVADA' ? 'success' : 'pending'}>{s.status === 'APROVADA' ? t('Ativo') : t('Em Avaliação')}</Pill>
                          {s.verified ? <span className="bz-sub2">{t('Homologado')}</span> : null}
                        </td>
                        <td>
                          {s.rating ? <span className="svc-ratingrow"><Stars value={s.rating} /> <span className="svc-ratenum">{s.rating.toFixed(1)}</span></span> : <span className="bz-muted">—</span>}
                        </td>
                        <td>{s.lastTransaction ? <><span className="bz-mono">{s.lastTransaction.reference}</span><span className="bz-sub2">{formatDate(s.lastTransaction.createdAt)}</span></> : <span className="bz-muted">—</span>}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bz-side">
          <div className="bz-panel">
            <h3>{t('Top Fornecedores')}</h3>
            {top.length === 0 ? <p className="bz-sub">{t('Sem dados.')}</p> : top.map((s, i) => (
              <div className="bz-panel-row" key={s.id}>
                <span>{i + 1}. {s.name}</span>
                <strong style={{ color: '#16884f' }}>{s.rating.toFixed(1)}</strong>
              </div>
            ))}
          </div>
          <div className="bz-panel">
            <h3>{t('Ações Rápidas')}</h3>
            <button className="bz-qa"><Icon name="suppliers" size={14} /> {t('Convidar Fornecedor')}</button>
            <button className="bz-qa"><Icon name="report" size={14} /> {t('Relatório de Fornecedores')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
