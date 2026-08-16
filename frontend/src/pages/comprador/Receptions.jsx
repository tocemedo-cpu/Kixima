// src/pages/comprador/Receptions.jsx
// Recepção (item 9) — recepção de mercadorias/serviços por item de PO.
// Ligado a /api/buyer/receptions.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { Crumbs, PageHead, KpiRow, Tabs, Pill, Toolbar, SupplierCell, EmptyRow } from '../../components/BuyerUI';
import { Icon } from '../../components/icons';
import { formatDate } from '../../domain';
import { useI18n } from '../../i18n';

const TABS = [
  { key: 'TODOS', label: 'Todos' }, { key: 'A_RECEBER', label: 'A Receber' },
  { key: 'RECEBIDO', label: 'Recebidos' }, { key: 'DIVERGENCIA', label: 'Com Divergência' },
];
const ST = {
  A_RECEBER: { tone: 'info', label: 'A Receber' },
  RECEBIDO: { tone: 'success', label: 'Recebido' },
  DIVERGENCIA: { tone: 'danger', label: 'Com Divergência' },
};

export default function Receptions() {
  const { t } = useI18n();
  const nav = useNavigate();
  const [tab, setTab] = useState('TODOS');
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    api.get('/api/buyer/receptions', { status: tab, q: q || undefined })
      .then(setData).catch((e) => setError(e.message));
  }, [tab, q]);

  const k = data?.kpis;
  return (
    <div>
      <Crumbs trail={[{ label: 'Home', to: '/comprador' }, 'Recepção']} />
      <PageHead title="Recepção" subtitle="Acompanhe e gestione a recepção de mercadorias e serviços das suas ordens de compra." />

      <KpiRow cards={[
        { icon: 'truck', tone: 'info', label: 'A Receber', value: k?.aReceber ?? '—', sub: 'Itens aguardando' },
        { icon: 'reception', tone: 'success', label: 'Recebidos', value: k?.recebidos ?? '—', sub: 'Últimos 90 dias' },
        { icon: 'approvals', tone: 'danger', label: 'Com Divergência', value: k?.divergencia ?? '—', sub: 'Requerem atenção' },
        { icon: 'box', tone: 'neutral', label: 'Total de Itens', value: k?.total ?? '—', sub: 'Últimos 90 dias' },
      ]} />

      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      <Toolbar placeholder="Pesquisar por nº da PO, fornecedor, item…" q={q} onQ={setQ} />

      {error ? <div className="empty-state"><p>{error}</p></div> : (
        <div className="bz-card bz-tablewrap">
          <table className="bz-table">
            <thead><tr>
              <th>{t('Nº da PO')}</th><th>{t('Fornecedor')}</th><th>{t('Item / Descrição')}</th><th>{t('Qtd.')}</th>
              <th>{t('Data de Recebimento')}</th><th>{t('Status')}</th><th></th>
            </tr></thead>
            <tbody>
              {!data ? <tr><td colSpan={7}><EmptyRow>A carregar…</EmptyRow></td></tr>
                : data.items.length === 0 ? <tr><td colSpan={7}><EmptyRow>Sem itens.</EmptyRow></td></tr>
                : data.items.map((r) => (
                  <tr key={r.id}>
                    <td><span className="bz-mono">{r.reference}</span></td>
                    <td><SupplierCell supplier={r.supplier} /></td>
                    <td>{r.item}<span className="bz-sub2">SKU: {r.sku || '—'}</span></td>
                    <td>{r.quantity}</td>
                    <td>{r.receivedAt ? formatDate(r.receivedAt) : '—'}</td>
                    <td><Pill tone={ST[r.status]?.tone}>{ST[r.status]?.label || r.status}</Pill></td>
                    <td>
                      <div className="bz-actions">
                        {r.status === 'DIVERGENCIA' ? (
                          <button className="btn btn-danger btn-sm" onClick={() => nav(`/comprador/ordens/${r.poId}`)}>{t('Resolver')}</button>
                        ) : (
                          <button className="bz-iconbtn" title={t('Ver ordem')} onClick={() => nav(`/comprador/ordens/${r.poId}`)}><Icon name="search" size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
