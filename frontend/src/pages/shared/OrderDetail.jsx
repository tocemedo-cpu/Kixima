// src/pages/shared/OrderDetail.jsx
import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../api/client';
import { Loading, ErrorBanner, SuccessBanner , Field } from '../../components/Common';
import Badge from '../../components/Badge';
import PaymentSlaRing from '../../components/PaymentSlaRing';
import { PO_STATUS, formatDate, formatMoney } from '../../domain';
import { useI18n } from '../../i18n';
import Button from '../../components/Button';
import StartConversationButton from '../../components/chat/StartConversationButton';

const BACK_BY_ROLE = {
  COMPRADOR: '/comprador/ordens',
  COMPANY_ADMIN: '/empresa/aprovacoes',
  FORNECEDOR: '/fornecedor/ordens',
  FINANCEIRO: '/financeiro',
  ADMIN_SISTEMA: '/sistema',
};

export default function OrderDetail() {
  const { t } = useI18n();
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [po, setPo] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [refuseReason, setRefuseReason] = useState('');
  const [showRefuse, setShowRefuse] = useState(false);
  const [receptionNotes, setReceptionNotes] = useState('');
  const [showDivergence, setShowDivergence] = useState(false);
  const [resolveOutcome, setResolveOutcome] = useState(null); // 'ACEITE' | 'REPOSICAO'
  const [resolveNotes, setResolveNotes] = useState('');
  const [history, setHistory] = useState(null);

  const load = useCallback(() => {
    api.get(`/api/purchase-orders/${id}`).then(setPo).catch((e) => setError(e.message));
    // Linha do tempo auditável — não bloqueia o resto do ecrã se falhar (ex.:
    // pedido concorrente); a página principal já tem os dados que precisa.
    api.get(`/api/purchase-orders/${id}/history`).then(setHistory).catch(() => setHistory([]));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function runAction(action, body) {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await action(body);
      setSuccess(t('Ação registada com sucesso.'));
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !po) return <ErrorBanner message={error} />;
  if (!po) return <Loading />;

  const statusInfo = PO_STATUS[po.status] || {};

  const canApprove = user.role === 'COMPANY_ADMIN' && po.status === 'AGUARDANDO_APROVACAO' && !po.isCallOff;
  const canAcceptRefuse = user.role === 'FORNECEDOR' && po.status === 'APROVADA';
  const canDispatch = user.role === 'FORNECEDOR' && ((po.isCallOff && po.status === 'EM_EXECUCAO' && !po.dispatchedAt) || (!po.isCallOff && po.status === 'PAGA'));
  const canMarkDelivered = user.role === 'FORNECEDOR' && po.status === 'EM_EXECUCAO' && po.dispatchedAt;
  const canReceive = user.role === 'COMPRADOR' && ['ENTREGUE', 'EM_EXECUCAO'].includes(po.status);
  const canResolveDivergence = ['COMPRADOR', 'COMPANY_ADMIN'].includes(user.role) && po.status === 'RECEBIDA_COM_DIVERGENCIA';

  return (
    <div>
      <button className="btn btn-ghost btn-sm" style={{ marginBottom: 14 }} onClick={() => navigate(BACK_BY_ROLE[user.role])}>
        ← {t('Voltar')}
      </button>

      <div className="page-header">
        <div>
          <h1 className="mono" style={{ fontSize: 22 }}>{po.reference}</h1>
          <p>
            <Badge tone={statusInfo.tone}>{statusInfo.label}</Badge>
            {po.isCallOff ? <span style={{ marginLeft: 8 }}><Badge tone="info">Call-off</Badge></span> : null}
          </p>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 600, color: 'var(--navy-900)' }}>
          {formatMoney(po.totalAmount, po.currency)}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => window.open(`/documento/po/${po.id}`, '_blank')}>
          {t('Visualizar PDF (PO)')}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => window.open(`/documento/po/${po.id}?baixar=1`, '_blank')}>
          {t('Baixar PDF (PO)')}
        </button>
        {po.invoice ? (
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => window.open(`/documento/fatura/${po.id}`, '_blank')}>
              {t('Visualizar PDF (Fatura)')}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => window.open(`/documento/fatura/${po.id}?baixar=1`, '_blank')}>
              {t('Baixar PDF (Fatura)')}
            </button>
          </>
        ) : null}
        {user.companyId ? (
          <StartConversationButton
            contextType="purchase_order" contextId={po.id}
            label={user.companyType === 'FORNECEDOR' ? 'Falar com o comprador' : 'Falar com o fornecedor'}
          />
        ) : null}
      </div>

      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      <div className="grid-cols grid-2" style={{ alignItems: 'start' }}>
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <strong style={{ fontSize: 13.5 }}>{t('Itens')}</strong>
          <div className="bz-scroll-x">
          <table style={{ marginTop: 10 }}>
            <thead>
              <tr><th>{t('Produto')}</th><th>{t('Qtd.')}</th><th>{t('Preço unit.')}</th><th>{t('Total')}</th></tr>
            </thead>
            <tbody>
              {po.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.product?.name || item.productId}</td>
                  <td>{item.quantity}</td>
                  <td className="r">{formatMoney(item.unitPrice, po.currency)}</td>
                  <td className="r">{formatMoney(item.lineTotal, po.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <strong style={{ fontSize: 13.5 }}>{t('Pagamento garantido')}</strong>
          <div style={{ marginTop: 12 }}>
            <PaymentSlaRing acceptedAt={po.acceptedAt} paymentDueAt={po.paymentDueAt} paidAt={po.paidAt} />
          </div>
          <div style={{ marginTop: 16, fontSize: 12.5, color: 'var(--ink-600)', display: 'grid', gap: 6 }}>
            <div>{t('Emitida em')}: {formatDate(po.createdAt)}</div>
            {po.approvedAt ? <div>{t('Aprovada em')}: {formatDate(po.approvedAt)}</div> : null}
            {po.acceptedAt ? <div>{t('Aceite pelo fornecedor em')}: {formatDate(po.acceptedAt)}</div> : null}
            {po.dispatchedAt ? <div>{t('Despachada em')}: {formatDate(po.dispatchedAt)}</div> : null}
            {po.deliveredAt ? <div>{t('Entregue em')}: {formatDate(po.deliveredAt)}</div> : null}
            {po.receivedAt ? <div>{t('Receção confirmada em')}: {formatDate(po.receivedAt)} ({po.receptionStatus})</div> : null}
            {po.divergenceResolvedAt ? (
              <div>
                {t('Divergência resolvida em')}: {formatDate(po.divergenceResolvedAt)}{' '}
                ({po.divergenceResolution === 'REPOSICAO' ? t('reposição solicitada') : t('entrega aceite')})
                {po.divergenceResolutionNotes ? <> — {po.divergenceResolutionNotes}</> : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {(canApprove || canAcceptRefuse || canDispatch || canMarkDelivered || canReceive || canResolveDivergence) && (
        <div className="card card-pad" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {canApprove && (
            <>
              <button className="btn btn-accent" disabled={busy} onClick={() => runAction(() => api.patch(`/api/purchase-orders/${id}/approve`))}>
                {t('Aprovar PO')}
              </button>
              <button className="btn btn-danger" disabled={busy} onClick={() => setShowReject((v) => !v)}>
                {t('Rejeitar PO')}
              </button>
            </>
          )}

          {canAcceptRefuse && (
            <>
              <button className="btn btn-accent" disabled={busy} onClick={() => runAction(() => api.patch(`/api/purchase-orders/${id}/accept`))}>
                {t('Aceitar PO')}
              </button>
              <button className="btn btn-danger" disabled={busy} onClick={() => setShowRefuse((v) => !v)}>
                {t('Recusar PO')}
              </button>
            </>
          )}

          {canDispatch && (
            <Button variant="primary"  disabled={busy} onClick={() => runAction(() => api.patch(`/api/purchase-orders/${id}/dispatch`))}>
              {t('Despachar entrega')}
            </Button>
          )}

          {canMarkDelivered && (
            <Button variant="primary"  disabled={busy} onClick={() => runAction(() => api.patch(`/api/purchase-orders/${id}/delivered`))}>
              {t('Marcar como entregue')}
            </Button>
          )}

          {canReceive && (
            <>
              <button
                className="btn btn-accent"
                disabled={busy}
                onClick={() => runAction((body) => api.patch(`/api/purchase-orders/${id}/reception`, body), { conforme: true })}
              >
                {t('Confirmar receção conforme')}
              </button>
              <button className="btn btn-danger" disabled={busy} onClick={() => setShowDivergence((v) => !v)}>
                {t('Reportar divergência')}
              </button>
            </>
          )}

          {canResolveDivergence && (
            <>
              <button
                className="btn btn-accent"
                disabled={busy}
                onClick={() => setResolveOutcome((v) => (v === 'ACEITE' ? null : 'ACEITE'))}
              >
                {t('Aceitar entrega e concluir')}
              </button>
              <Button variant="primary"
                
                disabled={busy}
                onClick={() => setResolveOutcome((v) => (v === 'REPOSICAO' ? null : 'REPOSICAO'))}
              >
                {t('Pedir reposição ao fornecedor')}
              </Button>
            </>
          )}
        </div>
      )}

      {canResolveDivergence && resolveOutcome && (
        <div className="card card-pad" style={{ marginTop: 12 }}>
          <strong style={{ fontSize: 13.5 }}>
            {resolveOutcome === 'ACEITE' ? t('Aceitar a entrega como está') : t('Pedir reposição/correção')}
          </strong>
          <p className="helptext" style={{ margin: '8px 0 10px' }}>
            {resolveOutcome === 'ACEITE'
              ? t('A divergência fica registada, mas a entrega é aceite (ex.: após acordo com o fornecedor) e a ordem é CONCLUÍDA.')
              : t('O fornecedor será notificado para corrigir/reentregar. A ordem volta a "Em execução" e, após a nova entrega, confirma a receção outra vez.')}
          </p>
          <Field label={`${t('Notas')} ${resolveOutcome === 'REPOSICAO' ? t('(o que deve ser corrigido)') : t('(opcional)')}`}>
            {(id) => (<>
              <textarea id={id}
                rows={3}
                value={resolveNotes}
                onChange={(e) => setResolveNotes(e.target.value)}
                placeholder={resolveOutcome === 'REPOSICAO' ? t('Ex.: repor as 3 unidades danificadas…') : t('Ex.: acordado desconto de 10% com o fornecedor…')}
              />
            </>)}
          </Field>
          {/* Estava aqui um ternário entre `btn-accent` e `btn-primary` — duas
              classes com exatamente o mesmo fundo e o mesmo hover. Quem o
              escreveu queria que "aceitar e concluir" e "pedir reposição"
              tivessem aparências diferentes; nunca tiveram, e o ternário
              limitava-se a dar trabalho ao browser.

              A aparência fica EXATAMENTE como está hoje: preserva-se o que se
              vê e remove-se o que engana. Se a distinção visual for mesmo
              desejada, faz-se dando outra `variant` a um dos dois — que é
              agora uma alteração de uma palavra. */}
          <Button
            variant="primary"
            disabled={busy || (resolveOutcome === 'REPOSICAO' && !resolveNotes.trim())}
            onClick={() => runAction(
              (body) => api.patch(`/api/purchase-orders/${id}/resolve-divergence`, body),
              { outcome: resolveOutcome, notes: resolveNotes.trim() || undefined },
            )}
          >
            {resolveOutcome === 'ACEITE' ? t('Confirmar: aceitar e concluir') : t('Confirmar: pedir reposição')}
          </Button>
        </div>
      )}

      {showReject && (
        <div className="card card-pad" style={{ marginTop: 12 }}>
          <Field label={t('Motivo da rejeição')}>
            {(id) => (<>
              <textarea id={id} rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            </>)}
          </Field>
          <button
            className="btn btn-danger"
            disabled={busy || !rejectReason.trim()}
            onClick={() => runAction((body) => api.patch(`/api/purchase-orders/${id}/reject`, body), { reason: rejectReason })}
          >
            {t('Confirmar rejeição')}
          </button>
        </div>
      )}

      {showRefuse && (
        <div className="card card-pad" style={{ marginTop: 12 }}>
          <Field label={t('Motivo da recusa')}>
            {(id) => (<>
              <textarea id={id} rows={3} value={refuseReason} onChange={(e) => setRefuseReason(e.target.value)} placeholder={t('Ex.: sem stock suficiente para cumprir a quantidade pedida…')} />
            </>)}
          </Field>
          <p className="helptext" style={{ marginBottom: 10 }}>
            {t('O comprador é notificado do motivo — é obrigatório para recusar.')}
          </p>
          <button
            className="btn btn-danger"
            disabled={busy || !refuseReason.trim()}
            onClick={() => runAction((body) => api.patch(`/api/purchase-orders/${id}/refuse`, body), { reason: refuseReason.trim() })}
          >
            {t('Confirmar recusa')}
          </button>
        </div>
      )}

      {showDivergence && (
        <div className="card card-pad" style={{ marginTop: 12 }}>
          <Field label={t('Descreva a divergência')}>
            {(id) => (<>
              <textarea id={id} rows={3} value={receptionNotes} onChange={(e) => setReceptionNotes(e.target.value)} placeholder={t('Ex.: quantidade incompleta, item danificado…')} />
            </>)}
          </Field>
          <p className="helptext" style={{ marginBottom: 10 }}>
            {t('A KIXIMA e o fornecedor serão notificados. Depois, resolve a divergência aqui mesmo: aceitar a entrega (após acordo) ou pedir reposição.')}
          </p>
          <button
            className="btn btn-danger"
            disabled={busy || !receptionNotes.trim()}
            onClick={() => runAction((body) => api.patch(`/api/purchase-orders/${id}/reception`, body), { conforme: false, notes: receptionNotes })}
          >
            {t('Reportar divergência')}
          </button>
        </div>
      )}

      {po.rejectionReason ? (
        <div className="banner banner-error" style={{ marginTop: 16 }}>{t('Motivo da rejeição')}: {po.rejectionReason}</div>
      ) : null}
      {po.refusalReason ? (
        <div className="banner banner-error" style={{ marginTop: 16 }}>{t('Motivo da recusa do fornecedor')}: {po.refusalReason}</div>
      ) : null}

      <OrderTimeline events={history} t={t} />
    </div>
  );
}

// Ações de auditoria (AuditLog.action) -> título e ícone legíveis. Uma
// entrada sem tradução aqui ainda aparece (com a ação em cru) — não fica
// invisível só porque um evento novo esqueceu de ser mapeado.
const TIMELINE_LABELS = {
  PO_CRIADA: { label: 'PO criada', icon: '📝' },
  PO_APROVADA: { label: 'Aprovada pelo Company Admin', icon: '✅' },
  PO_REJEITADA: { label: 'Rejeitada pelo Company Admin', icon: '⛔' },
  PO_ACEITE: { label: 'Aceite pelo fornecedor', icon: '🤝' },
  PO_RECUSADA_FORNECEDOR: { label: 'Recusada pelo fornecedor', icon: '⛔' },
  PAGAMENTO_EXECUTADO: { label: 'Pagamento efetuado', icon: '💳' },
  PO_DESPACHADA: { label: 'Entrega despachada', icon: '🚚' },
  PO_ENTREGUE: { label: 'Marcada como entregue', icon: '📦' },
  RECECAO_MERCADORIA: { label: 'Receção confirmada', icon: '📥' },
  DIVERGENCIA_RESOLVIDA: { label: 'Divergência resolvida', icon: '🛠️' },
  PO_CONCLUIDA: { label: 'Ordem concluída', icon: '🏁' },
};

// Detalhe do registo (JSON livre) -> uma linha curta, quando há algo que vale
// a pena mostrar. O resto do `detail` fica no registo, só não neste resumo.
function timelineDetail(action, detail, t) {
  if (!detail) return null;
  if (detail.motivo) return `${t('Motivo')}: ${detail.motivo}`;
  if (detail.desfecho) return `${t('Desfecho')}: ${detail.desfecho === 'REPOSICAO' ? t('reposição solicitada') : t('entrega aceite')}`;
  if (typeof detail.conforme === 'boolean') return detail.conforme ? t('Sem divergências') : t('Com divergência');
  if (detail.valor) return `${t('Valor')}: ${formatMoney(detail.valor, detail.moeda || 'AOA')}`;
  return null;
}

// Linha do tempo auditável — vem do AuditLog (append-only: sem caminho de
// update/delete no backend), por isso é o mais perto que a KIXIMA tem de um
// registo à prova de alteração. Visível a todas as personas autorizadas pela
// PO (RBAC validado no servidor, não aqui).
function OrderTimeline({ events, t }) {
  return (
    <div className="card card-pad" style={{ marginTop: 16 }}>
      <strong style={{ fontSize: 13.5 }}>{t('Linha do tempo')}</strong>
      <p className="helptext" style={{ margin: '4px 0 12px' }}>
        {t('Registo de auditoria — cada evento é gravado no momento em que acontece e não pode ser alterado.')}
      </p>
      {events === null ? (
        <Loading />
      ) : events.length === 0 ? (
        <p className="helptext">{t('Ainda sem eventos registados.')}</p>
      ) : (
        <ol className="po-timeline">
          {events.map((ev) => {
            const info = TIMELINE_LABELS[ev.action] || { label: ev.action, icon: '•' };
            const detail = timelineDetail(ev.action, ev.detail, t);
            return (
              <li key={ev.id} className="po-timeline-item">
                <span className="po-timeline-icon" aria-hidden="true">{info.icon}</span>
                <div>
                  <div><strong>{t(info.label)}</strong> — {formatDate(ev.createdAt)}</div>
                  <div className="helptext">
                    {ev.actorName ? `${ev.actorName} (${ev.actorRole || ''})` : t('Sistema')}
                  </div>
                  {detail ? <div className="helptext">{detail}</div> : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
