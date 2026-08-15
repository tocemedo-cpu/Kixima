// src/pages/fornecedor/OrderHistory.jsx
// Pedidos → Histórico. Ordens já concluídas/fechadas recebidas pela empresa.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { PageHeader, Loading, ErrorBanner } from '../../components/Common';
import Badge from '../../components/Badge';
import { PO_STATUS, formatDate, formatMoney } from '../../domain';
import { useI18n } from '../../i18n';

const CLOSED = new Set(['CONCLUIDA', 'RECEBIDA_CONFORME', 'RECEBIDA_COM_DIVERGENCIA']);

export default function OrderHistory() {
  const { t } = useI18n();
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/api/purchase-orders').then(setOrders).catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorBanner message={error} />;
  if (!orders) return <Loading />;

  const closed = orders.filter((o) => CLOSED.has(o.status));

  return (
    <div>
      <PageHeader title="Pedidos — Histórico" subtitle="Ordens de compra já concluídas ou recebidas." />
      {closed.length === 0 ? (
        <div className="empty-state"><h3>{t('Sem histórico')}</h3><p>{t('Ordens concluídas aparecem aqui.')}</p></div>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>{t('Referência')}</th><th>{t('Cliente')}</th><th>{t('Data')}</th><th>{t('Estado')}</th><th style={{ textAlign: 'right' }}>{t('Valor')}</th></tr></thead>
            <tbody>
              {closed.map((o) => (
                <tr key={o.id} className="row-link" onClick={() => navigate(`/fornecedor/ordens/${o.id}`)}>
                  <td className="mono">{o.reference}</td>
                  <td>{o.buyerCompany?.name || '—'}</td>
                  <td>{formatDate(o.createdAt)}</td>
                  <td><Badge tone={PO_STATUS[o.status]?.tone}>{PO_STATUS[o.status]?.label || o.status}</Badge></td>
                  <td className="r" style={{ fontWeight: 700 }}>{formatMoney(o.totalAmount, o.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
