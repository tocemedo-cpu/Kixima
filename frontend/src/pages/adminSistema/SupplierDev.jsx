// src/pages/adminSistema/SupplierDev.jsx
// Admin do Sistema → Supplier Development. Candidaturas ao programa de apoio ao
// fornecedor nacional (emancipação burocrática e parcerias internacionais),
// recebidas pela página pública. O Admin acompanha o estado de cada caso.
import { useEffect, useState } from 'react';
import { Field, SuccessBanner } from '../../components/Common';
import { api } from '../../api/client';
import { Crumbs, PageHead, KpiRow, Tabs, Pill, Toolbar, EmptyRow, Pagination } from '../../components/BuyerUI';
import { formatDate } from '../../domain';
import { useI18n } from '../../i18n';
import Button from '../../components/Button';


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
  const [programFee, setProgramFee] = useState('');
  const EMPTY_APPROVE = { taxId: '', insurer: '', policyNumber: '', coverageAmount: '', currency: 'AOA', validFrom: '', validUntil: '' };
  const [approveForm, setApproveForm] = useState(EMPTY_APPROVE);
  const [error, setError] = useState('');
  // Confirmação depois da API responder — nunca antes. Um "guardado"
  // mostrado antes do servidor confirmar é uma mentira com bom aspeto.
  const [sucesso, setSucesso] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (status) params.set('status', status);
    if (q) params.set('q', q);
    api.get(`/api/supplier-development/requests?${params}`).then(setData).catch((e) => setError(e.message));
  }
  useEffect(load, [page, status, q]);

  async function patchRequest(id, body, close = true) {
    setSaving(true); setError('');
    try {
      await api.patch(`/api/supplier-development/requests/${id}`, { adminNotes: notes || undefined, ...body });
      setSucesso(t('Pedido atualizado.'));
      setTimeout(() => setSucesso(''), 3500);
      if (close) { setOpen(null); setNotes(''); setProgramFee(''); }
      load();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  const setRequestStatus = (id, status) => patchRequest(id, { status });
  // Receção da taxa de acesso que foi cobrada na submissão da intenção.
  const markFeePaid = (id) => patchRequest(id, { feeStatus: 'COBRADO' }, false);
  // Orçamento do restante do programa (os serviços prestados).
  const saveProgramFee = (id) => patchRequest(id, { programFeeUsd: Number(programFee) }, false);
  const updateApprove = (k, v) => setApproveForm((f) => ({ ...f, [k]: v }));

  // Concluir uma candidatura SEM empresa associada cria a empresa + a apólice
  // Fornecedor→KIXIMA e convida o contacto a definir a senha do primeiro
  // Company Admin — sem isto a candidatura "concluía-se" sem ninguém
  // conseguir alguma vez entrar (ver supplierDevService.approve).
  async function approveRequest(id) {
    setSaving(true); setError('');
    try {
      await api.patch(`/api/supplier-development/requests/${id}/approve`, {
        taxId: approveForm.taxId || undefined,
        policy: {
          insurer: approveForm.insurer,
          policyNumber: approveForm.policyNumber,
          coverageAmount: Number(approveForm.coverageAmount),
          currency: approveForm.currency,
          validFrom: approveForm.validFrom,
          validUntil: approveForm.validUntil,
        },
      });
      setSucesso(t('Candidatura aprovada. A empresa foi criada e o contacto recebeu o convite para definir a senha.'));
      setTimeout(() => setSucesso(''), 5000);
      setOpen(null); setNotes(''); setProgramFee(''); setApproveForm(EMPTY_APPROVE);
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
        { icon: 'wallet', tone: 'pending', label: 'Taxas por receber', value: k?.taxasPendentes ?? '—',
          sub: k ? t('{valor} USD emitidos na submissão', { valor: k.taxasPendentesUsd }) : t('Cobradas na submissão') },
      ]} />

      <Tabs tabs={STATUS} value={status} onChange={(v) => { setStatus(v); setPage(1); }} />
      <Toolbar placeholder="Pesquisar por empresa, referência ou email…" q={q} onQ={(v) => { setQ(v); setPage(1); }} />

      <SuccessBanner message={sucesso} />
      {error ? <div className="banner banner-error" style={{ marginBottom: 12 }}>{error}</div> : null}

      <div className="bz-card bz-tablewrap">
        <table className="bz-table">
          <thead>
            <tr>
              <th>{t('Referência')}</th><th>{t('Empresa')}</th><th>{t('Contacto')}</th>
              <th>{t('Percurso')}</th><th>{t('Recebida em')}</th><th>{t('Taxa de acesso')}</th><th>{t('Estado')}</th><th></th>
            </tr>
          </thead>
          <tbody>
            {!data ? <tr><td colSpan={8}><EmptyRow>A carregar…</EmptyRow></td></tr>
              : items.length === 0 ? <tr><td colSpan={8}><EmptyRow>Ainda não há candidaturas ao programa.</EmptyRow></td></tr>
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
                  <td>
                    <Pill tone={r.feeStatus === 'COBRADO' ? 'success' : 'pending'}>
                      {r.feeStatus === 'COBRADO' ? 'Recebida' : 'Por receber'}
                    </Pill>
                    <span className="bz-sub2">{r.accessFeeUsd ? `${r.accessFeeUsd} USD` : '—'}</span>
                  </td>
                  <td><Pill tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status] || r.status}</Pill></td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setOpen(open === r.id ? null : r.id); setNotes(r.adminNotes || ''); setProgramFee(r.programFeeUsd ?? ''); setApproveForm({ ...EMPTY_APPROVE, taxId: r.taxId || '' }); }}>
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
            {/* A taxa de acesso foi cobrada no acto da submissão: aqui regista-se
                a receção e orçamenta-se o restante do programa. */}
            <div className="bz-card" style={{ padding: 14, marginBottom: 12 }}>
              <p className="bz-sub2" style={{ marginTop: 0 }}>
                <strong>{t('Taxa de acesso')}:</strong>{' '}
                {r.accessFeeUsd ? `${r.accessFeeUsd} USD` : '—'} ·{' '}
                <Pill tone={r.feeStatus === 'COBRADO' ? 'success' : 'pending'}>
                  {r.feeStatus === 'COBRADO' ? 'Recebida' : 'Por receber'}
                </Pill>
                {r.feePaidAt ? ` · ${formatDate(r.feePaidAt)}` : ''}
              </p>
              <p className="bz-sub2">{t('Cobrada na submissão da intenção. O restante do programa é orçamentado aqui.')}</p>
              <div className="grid-cols grid-2" style={{ alignItems: 'end' }}>
                <Field label={t('Orçamento do restante do programa (USD)')} style={{ marginBottom: 0 }}>
                  {(id) => (<>
                    <input id={id} type="number" min="0" step="0.01" value={programFee}
                      onChange={(e) => setProgramFee(e.target.value)}
                      placeholder={r.customPricing ? t('Por orçamentar') : ''} />
                  </>)}
                </Field>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingBottom: 2 }}>
                  <button className="btn btn-ghost btn-sm" disabled={saving || programFee === ''}
                    onClick={() => saveProgramFee(r.id)}>{t('Guardar orçamento')}</button>
                  <Button variant="primary" size="sm"  disabled={saving || r.feeStatus === 'COBRADO'}
                    onClick={() => markFeePaid(r.id)}>{t('Registar receção da taxa')}</Button>
                </div>
              </div>
            </div>

            <Field label={t('Notas de acompanhamento (internas)')}>
              {(id) => (<>
                <textarea id={id} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </>)}
            </Field>

            {!r.companyId && r.status !== 'CONCLUIDA' && r.status !== 'REJEITADA' ? (
              <div className="bz-card" style={{ padding: 14, marginBottom: 12 }}>
                <p className="bz-sub2" style={{ marginTop: 0 }}>
                  <strong>{t('Concluir e criar a conta')}</strong>
                </p>
                <p className="bz-sub2">
                  {t('Esta candidatura ainda não tem empresa na plataforma. Ao concluir, cria-se a empresa (Fornecedor), a apólice Fornecedor→KIXIMA e envia-se ao contacto um convite para definir a senha.')}
                </p>
                <Field label={t('NIF da empresa')} obrigatorio>
                  {(id) => (<>
                    <input id={id} required value={approveForm.taxId} onChange={(e) => updateApprove('taxId', e.target.value)} />
                  </>)}
                </Field>
                <div className="grid-cols grid-2">
                  <Field label={t('Seguradora')} obrigatorio>
                    {(id) => (<>
                      <input id={id} required value={approveForm.insurer} onChange={(e) => updateApprove('insurer', e.target.value)} />
                    </>)}
                  </Field>
                  <Field label={t('Nº da apólice')} obrigatorio>
                    {(id) => (<>
                      <input id={id} required value={approveForm.policyNumber} onChange={(e) => updateApprove('policyNumber', e.target.value)} />
                    </>)}
                  </Field>
                </div>
                <div className="grid-cols grid-2">
                  <Field label={t('Cobertura')} obrigatorio>
                    {(id) => (<>
                      <input id={id} type="number" min="0" step="any" required value={approveForm.coverageAmount} onChange={(e) => updateApprove('coverageAmount', e.target.value)} />
                    </>)}
                  </Field>
                  <Field label={t('Moeda')}>
                    {(id) => (<>
                      <select id={id} value={approveForm.currency} onChange={(e) => updateApprove('currency', e.target.value)}>
                        <option value="AOA">AOA</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                      </select>
                    </>)}
                  </Field>
                </div>
                <div className="grid-cols grid-2">
                  <Field label={t('Válida de')} obrigatorio>
                    {(id) => (<>
                      <input id={id} type="date" required value={approveForm.validFrom} onChange={(e) => updateApprove('validFrom', e.target.value)} />
                    </>)}
                  </Field>
                  <Field label={t('Válida até')} obrigatorio>
                    {(id) => (<>
                      <input id={id} type="date" required value={approveForm.validUntil} onChange={(e) => updateApprove('validUntil', e.target.value)} />
                    </>)}
                  </Field>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-accent btn-sm"
                    disabled={saving || !approveForm.taxId || !approveForm.insurer || !approveForm.policyNumber || !approveForm.coverageAmount || !approveForm.validFrom || !approveForm.validUntil}
                    onClick={() => approveRequest(r.id)}
                  >
                    {t('Concluir e criar a conta')}
                  </button>
                </div>
              </div>
            ) : null}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-ghost btn-sm" disabled={saving} onClick={() => setRequestStatus(r.id, 'EM_ANALISE')}>{t('Marcar em análise')}</button>
              <Button variant="primary" size="sm"  disabled={saving} onClick={() => setRequestStatus(r.id, 'EM_ACOMPANHAMENTO')}>{t('Em acompanhamento')}</Button>
              {r.companyId ? (
                <button className="btn btn-accent btn-sm" disabled={saving} onClick={() => setRequestStatus(r.id, 'CONCLUIDA')}>{t('Concluir')}</button>
              ) : null}
              <button className="btn btn-danger btn-sm" disabled={saving} onClick={() => setRequestStatus(r.id, 'REJEITADA')}>{t('Rejeitar')}</button>
            </div>
          </div>
        );
      })() : null}
    </div>
  );
}
