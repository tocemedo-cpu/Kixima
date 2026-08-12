// src/pages/adminSistema/SupplierDev.jsx
// Admin do Sistema → Supplier Development. Candidaturas ao programa de apoio ao
// fornecedor nacional (emancipação burocrática e parcerias internacionais),
// recebidas pela página pública. O Admin acompanha o estado de cada caso.
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { Crumbs, PageHead, KpiRow, Tabs, Pill, Toolbar, EmptyRow, Pagination } from '../../components/BuyerUI';
import { formatDate } from '../../domain';
import { useI18n } from '../../i18n';

const STATUS = [
  { key: '', label: 'Todas' },
  { key: 'RECEBIDA', label: 'Recebidas' },
  { key: 'EM_ANALISE', label: 'Em análise' },
  { key: 'EM_ACOMPANHAMENTO', label: 'Em acompanhamento' },
  { key: 'CONCLUIDA', label: 'Concluídas' },
  { key: 'REJEITADA', label: 'Rejeitadas' },
];
const STATUS_LABEL = {
  RECEBIDA: 'Recebida', EM_ANALISE: 'Em análise', EM_ACOMPANHAMENTO: 'Em acompanhamento',
  CONCLUIDA: 'Concluída', REJEITADA: 'Rejeitada',
};
const STATUS_TONE = {
  RECEBIDA: 'pending', EM_ANALISE: 'info', EM_ACOMPANHAMENTO: 'info',
  CONCLUIDA: 'success', REJEITADA: 'danger',
};
const TRACK_LABEL = { BUROCRACIA: 'Apoio burocrático', PARCERIA: 'Parceiro internacional', AMBOS: 'Ambos' };

export default function AdminSupplierDev() {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (status) params.set('status', status);
    if (q) params.set('q', q);
    api.get(`/api/supplier-development/requests?${params}`).then(setData).catch((e) => setError(e.message));
  }
  useEffect(load, [page, status, q]);

  async function setRequestStatus(id, next) {
    setSaving(true); setError('');
    try {
      await api.patch(`/api/supplier-development/requests/${id}`, { status: next, adminNotes: notes || undefined });
      setOpen(null); setNotes('');
      load();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  const k = data?.kpis;
  const items = data?.items || [];

  return (
    <div>
      <Crumbs trail={['Configurações e Suporte', 'Supplier Development']} />
      <PageHead
        title="Supplier Development"
        subtitle="Candidaturas ao programa de apoio ao fornecedor nacional: emancipação burocrática e procura de parceiros internacionais."
      />

      <KpiRow cards={[
        { icon: 'suppliers', tone: 'info', label: 'Candidaturas', value: k?.total ?? '—', sub: 'Total recebido' },
        { icon: 'approvals', tone: 'pending', label: 'Por analisar', value: k?.recebidas ?? '—', sub: 'Aguardam triagem' },
        { icon: 'activities', tone: 'info', label: 'Em acompanhamento', value: k?.acompanhamento ?? '—', sub: 'Casos ativos' },
        { icon: 'reception', tone: 'success', label: 'Concluídas', value: k?.concluidas ?? '—', sub: 'Processos fechados' },
      ]} />

      <Tabs tabs={STATUS} value={status} onChange={(v) => { setStatus(v); setPage(1); }} />
      <Toolbar placeholder="Pesquisar por empresa, referência ou email…" q={q} onQ={(v) => { setQ(v); setPage(1); }} />

      {error ? <div className="banner banner-error" style={{ marginBottom: 12 }}>{error}</div> : null}

      <div className="bz-card bz-tablewrap">
        <table className="bz-table">
          <thead>
            <tr>
              <th>{t('Referência')}</th><th>{t('Empresa')}</th><th>{t('Contacto')}</th>
              <th>{t('Percurso')}</th><th>{t('Recebida em')}</th><th>{t('Estado')}</th><th></th>
            </tr>
          </thead>
          <tbody>
            {!data ? <tr><td colSpan={7}><EmptyRow>A carregar…</EmptyRow></td></tr>
              : items.length === 0 ? <tr><td colSpan={7}><EmptyRow>Ainda não há candidaturas ao programa.</EmptyRow></td></tr>
              : items.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.reference}</td>
                  <td>
                    <strong>{r.companyName}</strong>
                    <span className="bz-sub2">{[r.sector, r.province].filter(Boolean).join(' · ') || '—'}</span>
                  </td>
                  <td>{r.contactName}<span className="bz-sub2">{r.contactEmail}</span></td>
                  <td className="bz-muted">{t(TRACK_LABEL[r.track] || r.track)}</td>
                  <td className="bz-muted">{formatDate(r.createdAt)}</td>
                  <td><Pill tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status] || r.status}</Pill></td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setOpen(open === r.id ? null : r.id); setNotes(r.adminNotes || ''); }}>
                      {open === r.id ? t('Fechar') : t('Ver / Acompanhar')}
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {data ? <Pagination page={data.page} pages={data.pages} total={data.total} onPage={setPage} unit="candidaturas" /> : null}

      {open ? (() => {
        const r = items.find((x) => x.id === open);
        if (!r) return null;
        return (
          <div className="bz-panel" style={{ marginTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>{r.companyName} · <span className="mono">{r.reference}</span></h3>
            <div className="grid-cols grid-2" style={{ marginBottom: 12 }}>
              <div>
                <p className="bz-sub2">{t('Contacto')}: {r.contactName} — {r.contactEmail}{r.contactPhone ? ` · ${r.contactPhone}` : ''}</p>
                <p className="bz-sub2">{t('Área de atividade')}: {r.sector || '—'} · {t('Província')}: {r.province || '—'}</p>
                <p className="bz-sub2">{t('Nº de trabalhadores')}: {r.employees ?? '—'} · {t('Percurso')}: {t(TRACK_LABEL[r.track] || r.track)}</p>
              </div>
              <div>
                <p className="bz-sub2"><strong>{t('O que precisa')}:</strong></p>
                <p style={{ fontSize: 13, lineHeight: 1.6 }}>{r.needs || '—'}</p>
              </div>
            </div>
            <div className="field">
              <label>{t('Notas de acompanhamento (internas)')}</label>
              <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-ghost btn-sm" disabled={saving} onClick={() => setRequestStatus(r.id, 'EM_ANALISE')}>{t('Marcar em análise')}</button>
              <button className="btn btn-primary btn-sm" disabled={saving} onClick={() => setRequestStatus(r.id, 'EM_ACOMPANHAMENTO')}>{t('Em acompanhamento')}</button>
              <button className="btn btn-accent btn-sm" disabled={saving} onClick={() => setRequestStatus(r.id, 'CONCLUIDA')}>{t('Concluir')}</button>
              <button className="btn btn-danger btn-sm" disabled={saving} onClick={() => setRequestStatus(r.id, 'REJEITADA')}>{t('Rejeitar')}</button>
            </div>
          </div>
        );
      })() : null}
    </div>
  );
}
