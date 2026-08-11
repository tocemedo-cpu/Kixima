// src/pages/fornecedor/Wallet.jsx
// Financeiro → Carteira. Resumo financeiro do fornecedor: já recebido, a receber
// e em execução, a partir das ordens recebidas.
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { PageHeader, Loading, ErrorBanner, StatCard } from '../../components/Common';
import Badge from '../../components/Badge';
import { PO_STATUS, formatDate, formatMoney } from '../../domain';
import { useI18n } from '../../i18n';

const RECEIVED = new Set(['PAGA', 'EM_EXECUCAO', 'ENTREGUE', 'RECEBIDA_CONFORME', 'RECEBIDA_COM_DIVERGENCIA', 'CONCLUIDA']);
const PENDING = new Set(['ACEITE_FORNECEDOR', 'AGUARDANDO_PAGAMENTO']);

export default function Wallet() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [orders, setOrders] = useState(null);
  const [feeStatement, setFeeStatement] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/purchase-orders').then(setOrders).catch((e) => setError(e.message));
  }, []);

  // Extrato da Taxa KIXIMA (o que a empresa deve à plataforma). Não bloqueia a
  // página se falhar — a carteira continua a funcionar.
  useEffect(() => {
    if (!user?.companyId) return;
    api.get(`/api/companies/${user.companyId}/platform-fees`).then(setFeeStatement).catch(() => {});
  }, [user?.companyId]);

  if (error) return <ErrorBanner message={error} />;
  if (!orders) return <Loading />;

  const sum = (set) => orders.filter((o) => set.has(o.status)).reduce((s, o) => s + Number(o.totalAmount), 0);
  const received = sum(RECEIVED);
  const pending = sum(PENDING);
  const recentPaid = orders
    .filter((o) => o.invoice?.payment)
    .sort((a, b) => new Date(b.invoice.payment.paidAt || b.createdAt) - new Date(a.invoice.payment.paidAt || a.createdAt))
    .slice(0, 8);

  return (
    <div>
      <PageHeader title="Financeiro — Carteira" subtitle="A sua posição financeira na plataforma." />

      <div className="grid-cols grid-3" style={{ marginBottom: 18 }}>
        <StatCard label="Já recebido" value={formatMoney(received)} sub="Ordens pagas ou em execução" />
        <StatCard label="A receber" value={formatMoney(pending)} sub="Aceites, a aguardar pagamento" />
        <StatCard label="Saldo movimentado" value={formatMoney(received + pending)} />
      </div>

      {feeStatement ? (
        <div className="card card-pad" style={{ marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <strong style={{ fontSize: 13.5 }}>{t('Taxa KIXIMA')}</strong>
            <p className="helptext" style={{ margin: '4px 0 0' }}>
              {feeStatement.kpis.pendentes > 0
                ? <>{t('Tem')} <strong>{formatMoney(feeStatement.kpis.pendingAOA)}</strong> {t('por liquidar')} ({feeStatement.kpis.pendentes} {feeStatement.kpis.pendentes === 1 ? t('taxa pendente') : t('taxas pendentes')}).</>
                : t('Sem taxas pendentes — está tudo liquidado.')}
              {' '}{t('Total gerado:')} {formatMoney(feeStatement.kpis.totalAOA)}.
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => window.open(`/documento/taxas/${user.companyId}`, '_blank')}>
            {t('Ver extrato completo')}
          </button>
        </div>
      ) : null}

      <div className="card">
        <div className="card-pad" style={{ borderBottom: '1px solid var(--line)' }}><strong>{t('Últimos recebimentos')}</strong></div>
        {recentPaid.length === 0 ? (
          <div className="card-pad"><p className="helptext" style={{ margin: 0 }}>{t('Ainda sem pagamentos recebidos.')}</p></div>
        ) : (
          <table>
            <thead><tr><th>{t('Referência')}</th><th>{t('Cliente')}</th><th>{t('Estado')}</th><th style={{ textAlign: 'right' }}>{t('Valor')}</th></tr></thead>
            <tbody>
              {recentPaid.map((o) => (
                <tr key={o.id}>
                  <td className="mono">{o.reference}</td>
                  <td>{o.buyerCompany?.name || '—'}</td>
                  <td><Badge tone={PO_STATUS[o.status]?.tone}>{PO_STATUS[o.status]?.label || o.status}</Badge></td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatMoney(o.totalAmount, o.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
