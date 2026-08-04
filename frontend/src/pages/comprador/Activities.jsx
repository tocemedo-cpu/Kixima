// src/pages/comprador/Activities.jsx
// Atividades (item 11) — tarefas do comprador derivadas do estado das POs.
// Ligado a /api/buyer/activities.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { Crumbs, PageHead, KpiRow, Tabs, Pill, Toolbar, EmptyRow } from '../../components/BuyerUI';
import { Icon } from '../../components/icons';
import { formatDateTime } from '../../domain';
import { useI18n } from '../../i18n';

const TABS = [
  { key: '', label: 'Todas' }, { key: 'PENDENTES', label: 'Pendentes' },
  { key: 'ANDAMENTO', label: 'Em Andamento' }, { key: 'CONCLUIDAS', label: 'Concluídas' },
  { key: 'ATRASADAS', label: 'Atrasadas' },
];
const ST = {
  PENDENTE: { tone: 'info', label: 'Pendente' }, AGUARDANDO: { tone: 'pending', label: 'Aguardando' },
  EM_ANDAMENTO: { tone: 'info', label: 'Em Andamento' }, CONCLUIDA: { tone: 'success', label: 'Concluída' },
  ATRASADA: { tone: 'danger', label: 'Atrasada' },
};
const PRIO = { ALTA: '#d94f4f', MEDIA: '#d98a1f', BAIXA: '#16a066' };
const ICON = { APROVAR: 'approvals', PAGAR: 'payment', RECEBER: 'reception', ENTREGA: 'truck', DIVERGENCIA: 'shield', CONCLUIDA: 'certification' };

export default function Activities() {
  const { t } = useI18n();
  const nav = useNavigate();
  const [tab, setTab] = useState('');
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    api.get('/api/buyer/activities', { filter: tab || undefined })
      .then(setData).catch((e) => setError(e.message));
  }, [tab]);

  const k = data?.kpis;
  const items = (data?.items || []).filter((t) => !q || t.title.toLowerCase().includes(q.toLowerCase()) || (t.relatedTo || '').toLowerCase().includes(q.toLowerCase()) || (t.supplier || '').toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <Crumbs trail={['Home', 'Atividades']} />
      <PageHead title="Atividades" subtitle="Acompanhe e gerencie todas as suas atividades e tarefas relacionadas ao procurement." />

      <KpiRow cards={[
        { icon: 'activities', tone: 'info', label: 'Minhas Tarefas', value: k?.minhasTarefas ?? '—', sub: 'Pendentes' },
        { icon: 'approvals', tone: 'pending', label: 'Aguardando Minha Ação', value: k?.aguardando ?? '—', sub: 'Prioritárias' },
        { icon: 'certification', tone: 'success', label: 'Concluídas', value: k?.concluidas ?? '—', sub: 'Últimos 30 dias' },
        { icon: 'shield', tone: 'danger', label: 'Atrasadas', value: k?.atrasadas ?? '—', sub: 'Requerem atenção' },
        { icon: 'truck', tone: 'info', label: 'Em Andamento', value: k?.emAndamento ?? '—', sub: 'Em progresso' },
      ]} />

      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      <Toolbar placeholder="Pesquisar por título, número, fornecedor…" q={q} onQ={setQ} />

      {error ? <div className="empty-state"><p>{error}</p></div> : (
        <div className="bz-card bz-tablewrap">
          <table className="bz-table">
            <thead><tr>
              <th>{t('Tipo')}</th><th>{t('Título / Descrição')}</th><th>{t('Relacionado a')}</th><th>{t('Fornecedor')}</th>
              <th>{t('Prioridade')}</th><th>{t('Status')}</th><th></th>
            </tr></thead>
            <tbody>
              {!data ? <tr><td colSpan={7}><EmptyRow>A carregar…</EmptyRow></td></tr>
                : items.length === 0 ? <tr><td colSpan={7}><EmptyRow>Sem atividades.</EmptyRow></td></tr>
                : items.map((t, i) => (
                  <tr key={i}>
                    <td><span className="bz-supplier-logo"><Icon name={ICON[t.type] || 'activities'} size={16} /></span></td>
                    <td><strong>{t.title}</strong><span className="bz-sub2">{t.desc}</span></td>
                    <td><span className="bz-mono">{t.relatedTo}</span></td>
                    <td>{t.supplier || '—'}</td>
                    <td><span style={{ color: PRIO[t.priority], fontWeight: 700 }}>● {t.priority[0] + t.priority.slice(1).toLowerCase()}</span></td>
                    <td><Pill tone={ST[t.status]?.tone}>{ST[t.status]?.label || t.status}</Pill></td>
                    <td>
                      <div className="bz-actions">
                        <button className="bz-iconbtn" title="Ver ordem" onClick={() => nav(`/comprador/ordens/${t.poId}`)}><Icon name="search" size={14} /></button>
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
