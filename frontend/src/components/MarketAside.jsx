// src/components/MarketAside.jsx
// Coluna direita do marketplace: mini-cesta (com Taxa KIXIMA + IVA + Total) e
// "Ordens em andamento" com contagens reais por estado.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { formatMoney, computeCartTotals } from '../domain';
import { useCart } from '../pages/comprador/CartContext';
import CategoryArt from './CategoryArt';
import { Icon } from './icons';

const BUCKETS = [
  { label: 'Aguardando pagamento', statuses: ['AGUARDANDO_APROVACAO', 'APROVADA', 'ACEITE_FORNECEDOR', 'AGUARDANDO_PAGAMENTO'], icon: 'payment' },
  { label: 'Em execução', statuses: ['EM_EXECUCAO', 'PAGA'], icon: 'orders' },
  { label: 'Em entrega', statuses: ['ENTREGUE'], icon: 'truck' },
  { label: 'Recebidas', statuses: ['RECEBIDA_CONFORME', 'CONCLUIDA'], icon: 'reception' },
];

export default function MarketAside() {
  const { items, total, updateQuantity, removeItem } = useCart();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    api.get('/api/purchase-orders').then(setOrders).catch(() => {});
  }, []);

  const totals = computeCartTotals(total);
  const countFor = (statuses) => orders.filter((o) => statuses.includes(o.status)).length;

  return (
    <aside className="market-aside">
      <div className="aside-card">
        <div className="aside-head">
          <span><Icon name="cart" size={16} /> Minha Cesta</span>
          <span className="aside-pill">{items.reduce((s, i) => s + i.quantity, 0)}</span>
        </div>

        {items.length === 0 ? (
          <p className="aside-empty">A sua cesta está vazia. Adicione itens do marketplace.</p>
        ) : (
          <>
            <div className="aside-items">
              {items.map((i) => (
                <div key={i.product.id} className="aside-item">
                  <span className="aside-thumb"><CategoryArt category={i.product.category} imageUrl={i.product.imageUrl} alt="" /></span>
                  <div className="aside-item-main">
                    <div className="aside-item-name">{i.product.name}</div>
                    <div className="aside-item-qty">
                      <button onClick={() => updateQuantity(i.product.id, i.quantity - 1)} aria-label="Menos">−</button>
                      <span>{i.quantity}</span>
                      <button onClick={() => updateQuantity(i.product.id, i.quantity + 1)} aria-label="Mais">+</button>
                      <button className="aside-remove" onClick={() => removeItem(i.product.id)} aria-label="Remover">✕</button>
                    </div>
                  </div>
                  <span className="aside-item-price mono">{formatMoney(Number(i.product.unitPrice) * i.quantity, i.product.currency)}</span>
                </div>
              ))}
            </div>

            <div className="aside-totals">
              <div><span>Subtotal</span><span className="mono">{formatMoney(totals.subtotal)}</span></div>
              <div><span>Taxa KIXIMA (1,5%)</span><span className="mono">{formatMoney(totals.fee)}</span></div>
              <div><span>IVA (14%)</span><span className="mono">{formatMoney(totals.iva)}</span></div>
              <div className="aside-total"><span>Total</span><span className="mono">{formatMoney(totals.total)}</span></div>
            </div>

            <button className="btn btn-accent" style={{ width: '100%' }} onClick={() => navigate('/comprador/cesta')}>
              Finalizar Compra
            </button>
          </>
        )}
      </div>

      <div className="aside-card">
        <div className="aside-head">
          <span><Icon name="orders" size={16} /> Ordens em andamento</span>
          <button className="aside-link" onClick={() => navigate('/comprador/ordens')}>Ver todas →</button>
        </div>
        <div className="aside-orders">
          {BUCKETS.map((b) => (
            <div key={b.label} className="aside-order-row" onClick={() => navigate('/comprador/ordens')}>
              <span className="aside-order-ic"><Icon name={b.icon} size={15} /></span>
              <span className="aside-order-label">{b.label}</span>
              <span className="aside-order-count">{countFor(b.statuses)}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
