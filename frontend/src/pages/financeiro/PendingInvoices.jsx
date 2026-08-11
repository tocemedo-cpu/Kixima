// src/pages/financeiro/PendingInvoices.jsx
// Faturas Pendentes — o Financeiro analisa e paga as faturas recebidas dentro
// do SLA. Ligado a /api/financeiro/invoices; pagamento via /api/payments.
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { Crumbs, PageHead, KpiRow, Pill, Toolbar, SupplierCell, EmptyRow } from '../../components/BuyerUI';
import { Icon } from '../../components/icons';
import { INVOICE_STATUS, formatMoney, formatDate } from '../../domain';
import { useI18n } from '../../i18n';

export default function PendingInvoices() {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [paying, setPaying] = useState(null);
  const [payModal, setPayModal] = useState(null); // fatura escolhida para pagar
  const [proof, setProof] = useState(null);       // ficheiro do comprovativo

  function load() { api.get('/api/financeiro/invoices').then(setData).catch((e) => setError(e.message)); }
  useEffect(load, []);

  // Pagamento exige o comprovativo da transferência (PDF/imagem) — é a prova,
  // visível ao fornecedor, de que o dinheiro saiu.
  async function confirmPay() {
    const inv = payModal;
    if (!inv || !proof) return;
    setPaying(inv.id); setError('');
    try {
      const fd = new FormData();
      fd.append('proof', proof);
      await api.postForm(`/api/payments/invoices/${inv.id}/pay`, fd);
      setToast(t('Fatura {ref} paga — comprovativo anexado.', { ref: inv.reference }));
      setTimeout(() => setToast(''), 3500);
      setPayModal(null); setProof(null);
      load();
    } catch (e) { setError(e.message); } finally { setPaying(null); }
  }

  const k = data?.kpis;
  const now = Date.now();
  const items = (data?.items || []).filter((i) => !q || i.reference.toLowerCase().includes(q.toLowerCase()) || (i.supplier || '').toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      {toast ? <div className="svc-toast">{toast}</div> : null}
      <Crumbs trail={['Financeiro', 'Faturas Pendentes']} />
      <PageHead title="Faturas Pendentes" subtitle="Analise e pague as faturas recebidas dentro do prazo (SLA de 7 dias)." />

      <KpiRow cards={[
        { icon: 'invoice', tone: 'pending', label: 'Total Pendentes', value: k?.pendentes ?? '—', sub: k ? formatMoney(k.valorPendente) : '' },
        { icon: 'history', tone: 'info', label: 'A vencer em 7 dias', value: k?.aVencer7 ?? '—', sub: 'Prioritárias' },
        { icon: 'approvals', tone: 'danger', label: 'Vencidas', value: k?.vencidas ?? '—', sub: 'Requerem atenção' },
        { icon: 'reception', tone: 'success', label: 'Pagas (mês)', value: k?.aprovadasMes ?? '—', sub: 'Processadas' },
      ]} />

      <Toolbar placeholder="Pesquisar por nº da fatura ou fornecedor…" q={q} onQ={setQ} />
      {error ? <div className="empty-state" style={{ padding: 14 }}><p>{error}</p></div> : null}

      <div className="bz-card bz-tablewrap">
        <table className="bz-table">
          <thead><tr><th>{t('Nº da Fatura')}</th><th>{t('Fornecedor')}</th><th>{t('PO')}</th><th className="r">{t('Valor')}</th><th>{t('Emissão')}</th><th>{t('Vencimento')}</th><th>{t('Status')}</th><th></th></tr></thead>
          <tbody>
            {!data ? <tr><td colSpan={8}><EmptyRow>A carregar…</EmptyRow></td></tr>
              : items.length === 0 ? <tr><td colSpan={8}><EmptyRow>Sem faturas pendentes.</EmptyRow></td></tr>
              : items.map((i) => {
                const overdue = new Date(i.dueAt).getTime() < now;
                return (
                  <tr key={i.id}>
                    <td><span className="bz-mono">{i.reference}</span></td>
                    <td><SupplierCell supplier={{ name: i.supplier }} /></td>
                    <td className="bz-muted bz-mono">{i.poReference || '—'}</td>
                    <td className="r"><strong>{formatMoney(i.amount, i.currency)}</strong></td>
                    <td>{formatDate(i.issuedAt)}</td>
                    <td style={{ color: overdue ? '#c0392b' : undefined }}>{formatDate(i.dueAt)}</td>
                    <td><Pill tone={overdue ? 'danger' : 'pending'}>{overdue ? 'Vencida' : 'Pendente'}</Pill></td>
                    <td className="r" style={{ whiteSpace: 'nowrap' }}>
                      {i.poId ? (
                        <button className="btn btn-ghost btn-sm" title={t('Ver fatura')} onClick={() => window.open(`/documento/fatura/${i.poId}`, '_blank')}>
                          <Icon name="report" size={14} /> {t('Ver')}
                        </button>
                      ) : null}
                      <button className="btn btn-accent btn-sm" style={{ marginLeft: 6 }} disabled={paying === i.id} onClick={() => { setPayModal(i); setProof(null); }}>{paying === i.id ? t('A pagar…') : t('Pagar')}</button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Modal de pagamento — comprovativo obrigatório */}
      {payModal ? (
        <div className="av-modal" onClick={() => { setPayModal(null); setProof(null); }}>
          <div className="hs-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="hs-modal-head">
              <h3>{t('Pagar fatura')} {payModal.reference}</h3>
              <button className="hs-modal-x" onClick={() => { setPayModal(null); setProof(null); }} aria-label={t('Fechar')}>✕</button>
            </div>
            <p className="bz-sub" style={{ marginTop: 4 }}>
              {t('Valor:')} <strong>{formatMoney(payModal.amount, payModal.currency)}</strong> · {t('Fornecedor:')} {payModal.supplier}
            </p>
            <p className="bz-sub" style={{ marginTop: 8 }}>
              {t('Faça a transferência bancária e anexe o')} <strong>{t('comprovativo')}</strong> {t('(PDF ou imagem). Ele fica visível ao fornecedor como prova do pagamento.')}
            </p>
            <div className="field" style={{ marginTop: 12 }}>
              <label>{t('Comprovativo da transferência')} <span className="req">*</span></label>
              <input type="file" accept=".pdf,image/*" onChange={(e) => setProof(e.target.files?.[0] || null)} />
              {proof ? <small className="helptext">{t('Selecionado:')} {proof.name} ({Math.round(proof.size / 1024)} KB)</small> : null}
            </div>
            <div className="hs-form-actions">
              <button className="btn btn-ghost" onClick={() => { setPayModal(null); setProof(null); }}>{t('Cancelar')}</button>
              <button className="btn btn-accent" disabled={!proof || paying === payModal.id} onClick={confirmPay}>
                {paying === payModal.id ? t('A pagar…') : t('Confirmar pagamento')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
