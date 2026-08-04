// src/pages/comprador/Deliveries.jsx
// Acompanhar Entrega (item 8) — estágio e progresso de cada PO em entrega.
// Ligado a /api/buyer/deliveries.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { Crumbs, PageHead, KpiRow, Tabs, Pill, Toolbar, SupplierCell, EmptyRow } from '../../components/BuyerUI';
import { Icon } from '../../components/icons';
import { formatDate } from '../../domain';
import { useI18n } from '../../i18n';

const TABS = [
  { key: 'TODAS', label: 'Todas' }, { key: 'EM_TRANSITO', label: 'Em Trânsito' },
  { key: 'EM_PREPARACAO', label: 'Em Preparação' }, { key: 'ENTREGUE', label: 'Entregues' },
  { key: 'CANCELADA', label: 'Canceladas' },
];
const STAGE_TONE = { EM_TRANSITO: 'info', EM_PREPARACAO: 'pending', ENTREGUE: 'success', CANCELADA: 'danger' };
const BAR_COLOR = { EM_TRANSITO: '#2f6fd6', EM_PREPARACAO: '#d98a1f', ENTREGUE: '#16a066', CANCELADA: '#d94f4f' };

export default function Deliveries() {
  const { t } = useI18n();
  const nav = useNavigate();
  const [tab, setTab] = useState('TODAS');
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    api.get('/api/buyer/deliveries', { stage: tab, q: q || undefined })
      .then(setData).catch((e) => setError(e.message));
  }, [tab, q]);

  const k = data?.kpis;
  return (
    <div>
      <Crumbs trail={['Home', 'Acompanhar Entrega']} />
      <PageHead title="Acompanhar Entrega" subtitle="Acompanhe o status e o progresso das entregas das suas ordens de compra." />

      <KpiRow cards={[
        { icon: 'truck', tone: 'info', label: 'Em Trânsito', value: k?.emTransito ?? '—', sub: 'Pedidos a caminho' },
        { icon: 'box', tone: 'pending', label: 'Em Preparação', value: k?.emPreparacao ?? '—', sub: 'Aguardando coleta' },
        { icon: 'reception', tone: 'success', label: 'Entregues', value: k?.entregues ?? '—', sub: 'Últimos 90 dias' },
        { icon: 'approvals', tone: 'danger', label: 'Canceladas', value: k?.canceladas ?? '—', sub: 'Últimos 90 dias' },
      ]} />

      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      <Toolbar placeholder="Pesquisar por nº da PO, fornecedor…" q={q} onQ={setQ} />

      {error ? <div className="empty-state"><p>{error}</p></div> : (
        <div className="bz-card bz-tablewrap">
          <table className="bz-table">
            <thead><tr>
              <th>{t('Nº da PO')}</th><th>{t('Fornecedor')}</th><th>{t('Data de Emissão')}</th><th>{t('Status')}</th>
              <th>{t('Localização')}</th><th>{t('Progresso')}</th><th></th>
            </tr></thead>
            <tbody>
              {!data ? <tr><td colSpan={7}><EmptyRow>A carregar…</EmptyRow></td></tr>
                : data.items.length === 0 ? <tr><td colSpan={7}><EmptyRow>Sem entregas.</EmptyRow></td></tr>
                : data.items.map((d) => (
                  <tr key={d.id}>
                    <td><span className="bz-mono">{d.reference}</span><span className="bz-sub2">{d.itemsCount} {d.itemsCount === 1 ? 'item' : 'itens'}</span></td>
                    <td><SupplierCell supplier={d.supplier} /></td>
                    <td>{formatDate(d.emittedAt)}</td>
                    <td><Pill tone={STAGE_TONE[d.stage]}>{d.label}</Pill></td>
                    <td><span className="bz-muted"><Icon name="offshore" size={12} /> {d.location}</span></td>
                    <td>
                      <div className="bz-progressrow">
                        <span className="bz-progress"><span style={{ width: `${d.progress}%`, background: BAR_COLOR[d.stage] }} /></span>
                        <span className="bz-muted">{d.progress}%</span>
                      </div>
                    </td>
                    <td>
                      <div className="bz-actions">
                        <button className="bz-iconbtn" title="Ver ordem" onClick={() => nav(`/comprador/ordens/${d.id}`)}><Icon name="search" size={14} /></button>
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
