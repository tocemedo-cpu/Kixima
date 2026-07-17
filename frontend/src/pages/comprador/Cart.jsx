// src/pages/comprador/Cart.jsx
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { PageHeader, ErrorBanner } from '../../components/Common';
import { formatMoney } from '../../domain';
import { useCart } from './CartContext';

export default function Cart() {
  const { items, updateQuantity, removeItem, clear } = useCart();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [submittingSupplier, setSubmittingSupplier] = useState(null);
  const [successRef, setSuccessRef] = useState(null);

  const groups = useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      const supplierId = item.product.supplierId;
      if (!map.has(supplierId)) {
        map.set(supplierId, { supplier: item.product.supplier, items: [] });
      }
      map.get(supplierId).items.push(item);
    });
    return Array.from(map.values());
  }, [items]);

  async function checkoutGroup(group) {
    setError('');
    setSubmittingSupplier(group.supplier.id);
    try {
      const po = await api.post('/api/purchase-orders', {
        supplierCompanyId: group.supplier.id,
        items: group.items.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
      });
      group.items.forEach((i) => removeItem(i.product.id));
      setSuccessRef(po.reference);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmittingSupplier(null);
    }
  }

  if (items.length === 0 && !successRef) {
    return (
      <div>
        <PageHeader title="Cesta" subtitle="Reveja itens, quantidades e fornecedores antes do checkout." />
        <div className="empty-state">
          <h3>A sua cesta está vazia</h3>
          <p>Vá ao catálogo e adicione os itens que precisa.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Cesta" subtitle="Cada ordem de compra pertence a um único fornecedor — o checkout é feito por grupo." />
      <ErrorBanner message={error} />
      {successRef ? (
        <div className="banner banner-success" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Ordem de compra {successRef} emitida com sucesso.</span>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/comprador/ordens')}>Ver ordens de compra</button>
        </div>
      ) : null}

      {groups.map((group) => {
        const subtotal = group.items.reduce((sum, i) => sum + Number(i.product.unitPrice) * i.quantity, 0);
        return (
          <div key={group.supplier.id} className="card" style={{ marginBottom: 18 }}>
            <div className="card-pad" style={{ borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>{group.supplier.name}</strong>
              <span className="mono" style={{ fontSize: 13 }}>{formatMoney(subtotal, group.items[0].product.currency)}</span>
            </div>
            <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {group.items.map((item) => (
                <div key={item.product.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500 }}>{item.product.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-400)' }}>{formatMoney(item.product.unitPrice, item.product.currency)} / un.</div>
                  </div>
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => updateQuantity(item.product.id, Number(e.target.value))}
                    style={{ width: 64, border: '1px solid var(--line)', borderRadius: 6, padding: '6px 8px' }}
                  />
                  <button className="btn btn-ghost btn-sm" onClick={() => removeItem(item.product.id)}>Remover</button>
                </div>
              ))}
            </div>
            <div className="card-pad" style={{ borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-accent"
                disabled={submittingSupplier === group.supplier.id}
                onClick={() => checkoutGroup(group)}
              >
                {submittingSupplier === group.supplier.id ? 'A emitir PO…' : `Emitir PO para ${group.supplier.name}`}
              </button>
            </div>
          </div>
        );
      })}

      {groups.length > 0 ? (
        <button className="btn btn-ghost btn-sm" onClick={clear}>Esvaziar cesta</button>
      ) : null}
    </div>
  );
}
