// src/pages/shared/OrderDetail.jsx
import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../api/client';
import { Loading, ErrorBanner, SuccessBanner } from '../../components/Common';
import Badge from '../../components/Badge';
import PaymentSlaRing from '../../components/PaymentSlaRing';
import { PO_STATUS, formatDate, formatMoney } from '../../domain';

const BACK_BY_ROLE = {
  COMPRADOR: '/comprador/ordens',
  COMPANY_ADMIN: '/empresa/aprovacoes',
  FORNECEDOR: '/fornecedor/ordens',
  FINANCEIRO: '/financeiro',
  ADMIN_SISTEMA: '/sistema',
};

export default function OrderDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [po, setPo] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [receptionNotes, setReceptionNotes] = useState('');
  const [showDivergence, setShowDivergence] = useState(false);

  const load = useCallback(() => {
    api.get(`/api/purchase-orders/${id}`).then(setPo).catch((e) => setError(e.message));
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
      setSuccess('Ação registada com sucesso.');
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

  return (
    <div>
      <button className="btn btn-ghost btn-sm" style={{ marginBottom: 14 }} onClick={() => navigate(BACK_BY_ROLE[user.role])}>
        ← Voltar
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

      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      <div className="grid-cols grid-2" style={{ alignItems: 'start' }}>
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <strong style={{ fontSize: 13.5 }}>Itens</strong>
          <table style={{ marginTop: 10 }}>
            <thead>
              <tr><th>Produto</th><th>Qtd.</th><th>Preço unit.</th><th>Total</th></tr>
            </thead>
            <tbody>
              {po.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.product?.name || item.productId}</td>
                  <td>{item.quantity}</td>
                  <td>{formatMoney(item.unitPrice, po.currency)}</td>
                  <td>{formatMoney(item.lineTotal, po.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <strong style={{ fontSize: 13.5 }}>Pagamento garantido</strong>
          <div style={{ marginTop: 12 }}>
            <PaymentSlaRing acceptedAt={po.acceptedAt} paymentDueAt={po.paymentDueAt} paidAt={po.paidAt} />
          </div>
          <div style={{ marginTop: 16, fontSize: 12.5, color: 'var(--ink-600)', display: 'grid', gap: 6 }}>
            <div>Emitida em: {formatDate(po.createdAt)}</div>
            {po.approvedAt ? <div>Aprovada em: {formatDate(po.approvedAt)}</div> : null}
            {po.acceptedAt ? <div>Aceite pelo fornecedor em: {formatDate(po.acceptedAt)}</div> : null}
            {po.dispatchedAt ? <div>Despachada em: {formatDate(po.dispatchedAt)}</div> : null}
            {po.deliveredAt ? <div>Entregue em: {formatDate(po.deliveredAt)}</div> : null}
            {po.receivedAt ? <div>Receção confirmada em: {formatDate(po.receivedAt)} ({po.receptionStatus})</div> : null}
          </div>
        </div>
      </div>

      {(canApprove || canAcceptRefuse || canDispatch || canMarkDelivered || canReceive) && (
        <div className="card card-pad" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {canApprove && (
            <>
              <button className="btn btn-accent" disabled={busy} onClick={() => runAction(() => api.patch(`/api/purchase-orders/${id}/approve`))}>
                Aprovar PO
              </button>
              <button className="btn btn-danger" disabled={busy} onClick={() => setShowReject((v) => !v)}>
                Rejeitar PO
              </button>
            </>
          )}

          {canAcceptRefuse && (
            <>
              <button className="btn btn-accent" disabled={busy} onClick={() => runAction(() => api.patch(`/api/purchase-orders/${id}/accept`))}>
                Aceitar PO
              </button>
              <button className="btn btn-danger" disabled={busy} onClick={() => runAction(() => api.patch(`/api/purchase-orders/${id}/refuse`))}>
                Recusar PO
              </button>
            </>
          )}

          {canDispatch && (
            <button className="btn btn-primary" disabled={busy} onClick={() => runAction(() => api.patch(`/api/purchase-orders/${id}/dispatch`))}>
              Despachar entrega
            </button>
          )}

          {canMarkDelivered && (
            <button className="btn btn-primary" disabled={busy} onClick={() => runAction(() => api.patch(`/api/purchase-orders/${id}/delivered`))}>
              Marcar como entregue
            </button>
          )}

          {canReceive && (
            <>
              <button
                className="btn btn-accent"
                disabled={busy}
                onClick={() => runAction((body) => api.patch(`/api/purchase-orders/${id}/reception`, body), { conforme: true })}
              >
                Confirmar receção conforme
              </button>
              <button className="btn btn-danger" disabled={busy} onClick={() => setShowDivergence((v) => !v)}>
                Reportar divergência
              </button>
            </>
          )}
        </div>
      )}

      {showReject && (
        <div className="card card-pad" style={{ marginTop: 12 }}>
          <div className="field">
            <label>Motivo da rejeição</label>
            <textarea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          </div>
          <button
            className="btn btn-danger"
            disabled={busy || !rejectReason.trim()}
            onClick={() => runAction((body) => api.patch(`/api/purchase-orders/${id}/reject`, body), { reason: rejectReason })}
          >
            Confirmar rejeição
          </button>
        </div>
      )}

      {showDivergence && (
        <div className="card card-pad" style={{ marginTop: 12 }}>
          <div className="field">
            <label>Descreva a divergência</label>
            <textarea rows={3} value={receptionNotes} onChange={(e) => setReceptionNotes(e.target.value)} placeholder="Ex.: quantidade incompleta, item danificado…" />
          </div>
          <p className="helptext" style={{ marginBottom: 10 }}>
            Isto abre um caso a acompanhar fora da plataforma (sinistro da apólice). A KIXIMA será notificada.
          </p>
          <button
            className="btn btn-danger"
            disabled={busy || !receptionNotes.trim()}
            onClick={() => runAction((body) => api.patch(`/api/purchase-orders/${id}/reception`, body), { conforme: false, notes: receptionNotes })}
          >
            Reportar divergência
          </button>
        </div>
      )}

      {po.rejectionReason ? (
        <div className="banner banner-error" style={{ marginTop: 16 }}>Motivo da rejeição: {po.rejectionReason}</div>
      ) : null}
    </div>
  );
}
