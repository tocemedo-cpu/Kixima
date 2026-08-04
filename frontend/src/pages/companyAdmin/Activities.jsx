// src/pages/companyAdmin/Activities.jsx
// Atividades — ações e interações da empresa derivadas do estado das POs.
// Ligado a /api/company-admin/activities.
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { Crumbs, PageHead, KpiRow, Tabs, Pill, Toolbar, EmptyRow } from '../../components/BuyerUI';
import { Icon } from '../../components/icons';
import { formatDateTime } from '../../domain';
import { useI18n } from '../../i18n';

const TABS = [
  { key: 'TODOS', label: 'Todas' }, { key: 'CONCLUIDA', label: 'Concluídas' },
  { key: 'PENDENTE', label: 'Pendentes' }, { key: 'ANDAMENTO', label: 'Em Andamento' }, { key: 'ATRASADA', label: 'Atrasadas' },
];
const ST = {
  CONCLUIDA: { tone: 'success', label: 'Concluída' }, PENDENTE: { tone: 'pending', label: 'Pendente' },
  ANDAMENTO: { tone: 'info', label: 'Em Andamento' }, ATRASADA: { tone: 'danger', label: 'Atrasada' },
};

export default function Activities() {
  const { t } = useI18n();
  const [tab, setTab] = useState('TODOS');
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api.get('/api/company-admin/activities', { filter: tab }).then(setData).catch((e) => setError(e.message)); }, [tab]);

  const k = data?.kpis;
  const items = (data?.items || []).filter((t) => !q || t.title.toLowerCase().includes(q.toLowerCase()) || (t.party || '').toLowerCase().includes(q.toLowerCase()) || t.module.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <Crumbs trail={['Atividades']} />
      <PageHead title="Atividades" subtitle="Acompanhe todas as atividades e interações realizadas na plataforma." />

      <KpiRow cards={[
        { icon: 'activities', tone: 'info', label: 'Total de Atividades', value: k?.total ?? '—', sub: 'Registadas' },
        { icon: 'certification', tone: 'success', label: 'Concluídas', value: k?.concluidas ?? '—', sub: 'Finalizadas' },
        { icon: 'history', tone: 'pending', label: 'Pendentes', value: k?.pendentes ?? '—', sub: 'Aguardando' },
        { icon: 'truck', tone: 'info', label: 'Em Andamento', value: k?.andamento ?? '—', sub: 'A decorrer' },
        { icon: 'approvals', tone: 'danger', label: 'Atrasadas', value: k?.atrasadas ?? '—', sub: 'Requerem atenção' },
      ]} />

      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      <Toolbar placeholder="Buscar por descrição, tipo ou relacionado…" q={q} onQ={setQ} />

      {error ? <div className="empty-state"><p>{error}</p></div> : (
        <div className="bz-card bz-tablewrap">
          <table className="bz-table">
            <thead><tr><th>{t('Atividade')}</th><th>{t('Tipo')}</th><th>{t('Módulo')}</th><th>{t('Relacionado a')}</th><th>{t('Responsável')}</th><th>{t('Data/Hora')}</th><th>{t('Status')}</th></tr></thead>
            <tbody>
              {!data ? <tr><td colSpan={7}><EmptyRow>A carregar…</EmptyRow></td></tr>
                : items.length === 0 ? <tr><td colSpan={7}><EmptyRow>Sem atividades.</EmptyRow></td></tr>
                : items.map((t, i) => (
                  <tr key={i}>
                    <td><strong>{t.title}</strong><span className="bz-sub2">{t.desc}</span></td>
                    <td><Pill tone="neutral">{t.type}</Pill></td>
                    <td className="bz-muted">{t.module}</td>
                    <td><span className="bz-mono">{t.relatedTo}</span><span className="bz-sub2">{t.party || ''}</span></td>
                    <td>{t.responsavel || '—'}</td>
                    <td className="bz-muted">{formatDateTime(t.at)}</td>
                    <td><Pill tone={ST[t.status]?.tone}>{ST[t.status]?.label || t.status}</Pill></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
