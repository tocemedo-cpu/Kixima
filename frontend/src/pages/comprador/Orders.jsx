// src/pages/comprador/Orders.jsx
// Ordens de Compra (item 6) — KPIs, tabs por estado, tabela ligada a
// /api/buyer/orders. Cada linha abre o detalhe da PO.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { Crumbs, PageHead, KpiRow, Tabs, Pill, Toolbar, SupplierCell, EmptyRow, Pagination } from '../../components/BuyerUI';
import { Icon } from '../../components/icons';
import { PO_STATUS, formatMoney, formatDate } from '../../domain';
import { useI18n } from '../../i18n';
import { ErrorBanner } from '../../components/Common';

const TABS = [
  { key: '', label: 'Todas as Ordens' }, { key: 'ANDAMENTO', label: 'Em Andamento' },
  { key: 'CONCLUIDAS', label: 'Concluídas' }, { key: 'CANCELADAS', label: 'Canceladas' },
];

export default function Orders() {
  const { t } = useI18n();
  const nav = useNavigate();
  const [tab, setTab] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  // Volta à 1ª página ao mudar de filtro/pesquisa.
  useEffect(() => { setPage(1); }, [tab, q]);

  useEffect(() => {
    setError('');
    api.get('/api/buyer/orders', { status: tab || undefined, q: q || undefined, page, limit: 15 })
      .then(setData).catch((e) => setError(e.message));
  }, [tab, q, page]);

  const k = data?.kpis;
  return (
    <div>
      <Crumbs trail={[{ label: 'Home', to: '/comprador' }, 'Ordens de Compra']} />
      <PageHead title="Ordens de Compra" subtitle="Acompanhe todas as suas Ordens de Compra emitidas aos fornecedores." />

      <KpiRow cards={[
        { icon: 'orders', tone: 'info', label: 'Total de Ordens', value: k?.total ?? '—', sub: 'Todas as PO emitidas' },
        { icon: 'payment', tone: 'pending', label: 'Valor Total das PO', value: k ? formatMoney(k.valorTotal) : '—', sub: 'Valor total' },
        { icon: 'truck', tone: 'info', label: 'Em Andamento', value: k?.emAndamento ?? '—', sub: 'PO em processamento' },
        { icon: 'reception', tone: 'success', label: 'Concluídas', value: k?.concluidas ?? '—', sub: 'PO concluídas' },
        { icon: 'approvals', tone: 'danger', label: 'Canceladas', value: k?.canceladas ?? '—', sub: 'PO canceladas' },
      ]} />

      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      <Toolbar placeholder="Pesquisar por nº da PO, fornecedor…" q={q} onQ={setQ} />

      {/* Um erro NÃO é um estado vazio. "Não há ordens" e "não foi possível
          carregar as ordens" são coisas opostas, e apareciam iguais — quem
          via a segunda concluía que não tinha ordens nenhumas. */}
      {error ? <ErrorBanner message={error} /> : (
        <div className="bz-card bz-tablewrap">
          <table className="bz-table">
            <thead><tr>
              <th>{t('Nº da PO')}</th><th>{t('Fornecedor')}</th><th>{t('Data de Emissão')}</th><th>{t('Entrega Prevista')}</th>
              <th>{t('Itens')}</th><th className="r">{t('Valor Total')}</th><th>{t('Estado')}</th><th></th>
            </tr></thead>
            <tbody>
              {!data ? <tr><td colSpan={8}><EmptyRow>A carregar…</EmptyRow></td></tr>
                : data.items.length === 0 ? <tr><td colSpan={8}><EmptyRow>Sem ordens de compra.</EmptyRow></td></tr>
                : data.items.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <span className="bz-mono">{o.reference}</span>
                      <span className="bz-sub2">{o.isCallOff ? 'Call-off' : t('Gerada a partir do Checkout')}</span>
                    </td>
                    <td><SupplierCell supplier={o.supplier} /></td>
                    <td>{formatDate(o.createdAt)}</td>
                    <td>{o.paymentDueAt ? formatDate(o.paymentDueAt) : '—'}</td>
                    <td>{o.itemsCount} {o.itemsCount === 1 ? t('item') : t('itens')}</td>
                    <td className="r"><strong>{formatMoney(o.totalAmount, o.currency)}</strong></td>
                    <td><Pill tone={PO_STATUS[o.status]?.tone}>{PO_STATUS[o.status]?.label || o.status}</Pill></td>
                    <td>
                      <div className="bz-actions">
                        <button className="bz-iconbtn" title={t('Ver detalhes')} onClick={() => nav(`/comprador/ordens/${o.id}`)}><Icon name="search" size={14} /></button>
                        <button className="bz-iconbtn" title={t('Visualizar PDF')} onClick={() => nav(`/documento/po/${o.id}`)}><Icon name="invoice" size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {data ? <div style={{ padding: '10px 14px' }}><Pagination page={data.page} pages={data.pages} total={data.total} onPage={setPage} unit="ordens" /></div> : null}
        </div>
      )}
    </div>
  );
}
