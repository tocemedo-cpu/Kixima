// src/pages/financeiro/PendingInvoices.jsx
// Faturas Pendentes — o Financeiro analisa e paga as faturas recebidas dentro
// do SLA. Ligado a /api/financeiro/invoices; pagamento via /api/payments.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Field } from '../../components/Common';
import { api } from '../../api/client';
import { Crumbs, PageHead, KpiRow, Pill, Toolbar, SupplierCell, EmptyRow } from '../../components/BuyerUI';
import { Icon } from '../../components/icons';
import { INVOICE_STATUS, formatMoney, formatDate } from '../../domain';
import { useI18n } from '../../i18n';

export default function PendingInvoices() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [paying, setPaying] = useState(null);
  const [payModal, setPayModal] = useState(null); // fatura escolhida para pagar
  const [proof, setProof] = useState(null);       // ficheiro do comprovativo
  // Resultado do reenvio do FT à AGT (registarFactura) ao confirmar o
  // pagamento — ver paymentService.processPayment. Pedido explícito: o FT já
  // foi submetido uma vez na emissão da fatura; isto é um reenvio deliberado,
  // com visibilidade do payload/resposta (nunca acontece em silêncio como o
  // RC). Uma recusa aqui NUNCA significa que o pagamento falhou — o
  // pagamento já está confirmado quando este resultado chega.
  const [agtResultado, setAgtResultado] = useState(null);
  const [copiado, setCopiado] = useState(false);

  function load() { api.get('/api/financeiro/invoices').then(setData).catch((e) => setError(e.message)); }
  useEffect(load, []);

  // Pagamento exige o comprovativo da transferência (PDF/imagem) — é a prova,
  // visível ao fornecedor, de que o dinheiro saiu.
  async function confirmPay() {
    const inv = payModal;
    if (!inv || !proof) return;
    setPaying(inv.id); setError(''); setAgtResultado(null);
    try {
      const fd = new FormData();
      fd.append('proof', proof);
      const res = await api.postForm(`/api/payments/invoices/${inv.id}/pay`, fd);
      setToast(t('Fatura {ref} paga — comprovativo anexado.', { ref: inv.reference }));
      setTimeout(() => setToast(''), 3500);
      if (res.agtInvoiceResubmission) setAgtResultado({ ref: inv.reference, ...res.agtInvoiceResubmission });
      setPayModal(null); setProof(null);
      load();
    } catch (e) { setError(e.message); } finally { setPaying(null); }
  }

  async function copiarJson() {
    if (!agtResultado) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(agtResultado, null, 2));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sem acesso à área de transferência — o JSON continua visível para copiar à mão.
    }
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

      {agtResultado ? (
        <div className="bz-card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 13.5 }}>
              {agtResultado.sucesso
                ? t('Fatura {ref} reenviada à AGT (registarFactura)', { ref: agtResultado.ref })
                : t('A AGT recusou o reenvio da fatura {ref}', { ref: agtResultado.ref })}
            </strong>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAgtResultado(null)}>{t('Fechar')}</button>
          </div>
          {agtResultado.sucesso ? (
            <dl style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <div>
                <dt style={{ fontSize: 11, opacity: 0.65, textTransform: 'uppercase', letterSpacing: 0.3 }}>{t('documentNo')}</dt>
                <dd style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{agtResultado.payload?.documents?.[0]?.documentNo || '—'}</dd>
              </div>
              <div>
                <dt style={{ fontSize: 11, opacity: 0.65, textTransform: 'uppercase', letterSpacing: 0.3 }}>{t('resultCode')}</dt>
                <dd style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{String(agtResultado.resposta?.resultCode ?? '—')}</dd>
              </div>
            </dl>
          ) : (
            <p style={{ marginTop: 8, fontSize: 13 }}>
              {agtResultado.erro?.message}
              {agtResultado.erro?.details?.errorList?.length ? ` — ${JSON.stringify(agtResultado.erro.details.errorList)}` : ''}
            </p>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
            <span style={{ fontSize: 11, opacity: 0.65, textTransform: 'uppercase', letterSpacing: 0.3 }}>
              {t('JSON completo (payload enviado + resposta da AGT)')}
            </span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={copiarJson}>
              {copiado ? t('Copiado!') : t('Copiar JSON')}
            </button>
          </div>
          <pre className="bz-scroll-x" style={{ marginTop: 6, padding: 12, background: 'var(--surface-2, #fafafa)', borderRadius: 8, fontSize: 12, lineHeight: 1.5, maxHeight: 360, overflowY: 'auto' }}>
            {JSON.stringify(agtResultado, null, 2)}
          </pre>
        </div>
      ) : null}

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
                        <button className="btn btn-ghost btn-sm" title={t('Ver fatura')} onClick={() => navigate(`/documento/fatura/${i.poId}`)}>
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
            <Field label={t('Comprovativo da transferência')} obrigatorio style={{ marginTop: 12 }}>
              {(id) => (<>
                <input id={id} type="file" accept=".pdf,image/*" onChange={(e) => setProof(e.target.files?.[0] || null)} />
                {proof ? <small className="helptext">{t('Selecionado:')} {proof.name} ({Math.round(proof.size / 1024)} KB)</small> : null}
              </>)}
            </Field>
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
