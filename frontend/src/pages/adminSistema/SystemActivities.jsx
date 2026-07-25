// src/pages/adminSistema/SystemActivities.jsx
// Gestão de Atividades — feed de tudo o que acontece dentro do sistema
// (substitui a tela de notificações do Admin do Sistema). Ligado a
// /api/admin/activities.
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { Crumbs, PageHead, KpiRow, Tabs, Pill, Toolbar, EmptyRow } from '../../components/BuyerUI';
import { Icon } from '../../components/icons';
import { formatDateTime } from '../../domain';

const TYPE_ICON = {
  'Ordem de Compra': 'orders', Empresa: 'building', Utilizador: 'users',
  Pagamento: 'payment', Suporte: 'help', Apólice: 'policy',
};
const TYPE_TONE = {
  'Ordem de Compra': 'info', Empresa: 'success', Utilizador: 'info',
  Pagamento: 'pending', Suporte: 'neutral', Apólice: 'success',
};

export default function SystemActivities() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { api.get('/api/admin/activities').then(setData).catch((e) => setError(e.message)); }, []);

  const k = data?.kpis;
  const types = [...new Set((data?.items || []).map((i) => i.type))];
  const tabs = [{ key: '', label: 'Tudo' }, ...types.map((t) => ({ key: t, label: t }))];
  let items = data?.items || [];
  if (tab) items = items.filter((i) => i.type === tab);
  if (q) items = items.filter((i) => i.title.toLowerCase().includes(q.toLowerCase()) || i.detail.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <Crumbs trail={['Configurações e Suporte', 'Gestão de Atividades']} />
      <PageHead title="Gestão de Atividades" subtitle="Tudo o que acontece dentro do sistema — ordens, empresas, utilizadores, pagamentos, apólices e suporte." />

      <KpiRow cards={[
        { icon: 'building', tone: 'info', label: 'Empresas', value: k?.empresas ?? '—', sub: 'Registadas' },
        { icon: 'users', tone: 'info', label: 'Utilizadores', value: k?.utilizadores ?? '—', sub: 'Contas' },
        { icon: 'orders', tone: 'success', label: 'Ordens de Compra', value: k?.ordens ?? '—', sub: 'Total' },
        { icon: 'payment', tone: 'pending', label: 'Pagamentos', value: k?.pagamentos ?? '—', sub: 'Processados' },
        { icon: 'help', tone: 'neutral', label: 'Pedidos de Suporte', value: k?.tickets ?? '—', sub: 'Total' },
      ]} />

      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      <Toolbar placeholder="Pesquisar atividade…" q={q} onQ={setQ} />

      {error ? <div className="empty-state"><p>{error}</p></div> : (
        <div className="bz-card bz-tablewrap">
          <table className="bz-table">
            <thead><tr><th>Tipo</th><th>Descrição</th><th>Módulo</th><th>Quando</th></tr></thead>
            <tbody>
              {!data ? <tr><td colSpan={4}><EmptyRow>A carregar…</EmptyRow></td></tr>
                : items.length === 0 ? <tr><td colSpan={4}><EmptyRow>Sem atividades.</EmptyRow></td></tr>
                : items.map((i, idx) => (
                  <tr key={idx}>
                    <td><span className="bz-supplier-logo" style={{ display: 'inline-flex', marginRight: 8, verticalAlign: 'middle' }}><Icon name={TYPE_ICON[i.type] || 'activities'} size={15} /></span><Pill tone={TYPE_TONE[i.type] || 'neutral'}>{i.type}</Pill></td>
                    <td><strong>{i.title}</strong><span className="bz-sub2">{i.detail}</span></td>
                    <td className="bz-muted">{i.module}</td>
                    <td className="bz-muted">{formatDateTime(i.at)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
