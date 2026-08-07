// src/pages/comprador/Cart.jsx
// Minha Cesta (item 4) — itens agrupados por fornecedor, quantidades e resumo.
// "Avançar para Checkout" leva ao Checkout, que gera uma PO por fornecedor.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crumbs, PageHead } from '../../components/BuyerUI';
import { Icon, Stars } from '../../components/icons';
import { IVA_RATE, KIXIMA_FEE_RATE, formatMoney } from '../../domain';
import { useCart } from './CartContext';
import { useI18n } from '../../i18n';

export default function Cart() {
  const { t } = useI18n();
  const { items, updateQuantity, removeItem, clear } = useCart();
  const nav = useNavigate();
  const [toast, setToast] = useState('');

  const subtotal = items.reduce((s, i) => s + Number(i.product.unitPrice) * i.quantity, 0);
  const iva = subtotal * IVA_RATE;
  const fee = subtotal * KIXIMA_FEE_RATE;
  const total = subtotal + iva + fee;

  function exportCart() {
    const blob = new Blob([JSON.stringify(items.map((i) => ({ name: i.product.name, qty: i.quantity, unitPrice: i.product.unitPrice })), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = 'cesta-kixima.json'; a.click(); URL.revokeObjectURL(url);
  }
  function saveCart() {
    localStorage.setItem('kixima_saved_cart', JSON.stringify(items.map((i) => ({ id: i.product.id, qty: i.quantity }))));
    setToast('Cesta guardada.'); setTimeout(() => setToast(''), 3000);
  }

  if (items.length === 0) {
    return (
      <div>
        <Crumbs trail={['Home', 'Minha Cesta']} />
        <div className="empty-state"><h3>{t('A sua cesta está vazia')}</h3><p>Explore o catálogo e adicione produtos ou serviços.</p>
          <button className="btn btn-accent" onClick={() => nav('/comprador/catalogo')}>Explorar catálogo</button></div>
      </div>
    );
  }

  return (
    <div>
      {toast ? <div className="svc-toast">{toast}</div> : null}
      <Crumbs trail={['Home', 'Minha Cesta']} />
      <PageHead title="Minha Cesta" subtitle={`${items.length} ${items.length === 1 ? 'item' : 'itens'} na sua cesta`}
        actions={<>
          <button className="btn btn-ghost btn-sm" onClick={saveCart}><Icon name="policy" size={14} /> Guardar Cesta</button>
          <button className="btn btn-ghost btn-sm" onClick={exportCart}><Icon name="report" size={14} /> Exportar Cesta</button>
          <button className="btn btn-ghost btn-sm" onClick={clear}><Icon name="approvals" size={14} /> Limpar Cesta</button>
        </>} />

      <div className="bz-layout">
        <div className="bz-card bz-tablewrap">
          <table className="bz-table">
            <thead><tr><th>{t('Produto / Serviço')}</th><th>{t('Fornecedor')}</th><th className="r">{t('Preço Unitário')}</th><th>{t('Qtd.')}</th><th className="r">{t('Subtotal')}</th><th></th></tr></thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.product.id}>
                  <td>
                    <strong>{it.product.name}</strong>
                    <span className="bz-sub2">SKU: {it.product.sku || '—'} · {it.product.category}</span>
                  </td>
                  <td>
                    <div>{it.product.supplier?.name}</div>
                    {it.product.rating ? <span className="svc-ratingrow"><Stars value={it.product.rating} /> <span className="svc-ratenum">{Number(it.product.rating).toFixed(1)}</span></span> : null}
                  </td>
                  <td className="r">{formatMoney(it.product.unitPrice, it.product.currency)}</td>
                  <td>
                    <div className="cart-qty">
                      <button onClick={() => updateQuantity(it.product.id, it.quantity - 1)}>−</button>
                      <input value={it.quantity} onChange={(e) => updateQuantity(it.product.id, Math.max(1, Number(e.target.value) || 1))} />
                      <button onClick={() => updateQuantity(it.product.id, it.quantity + 1)}>+</button>
                    </div>
                  </td>
                  <td className="r"><strong>{formatMoney(Number(it.product.unitPrice) * it.quantity, it.product.currency)}</strong></td>
                  <td><button className="bz-iconbtn" title="Remover" onClick={() => removeItem(it.product.id)}><Icon name="approvals" size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bz-side">
          <div className="bz-panel">
            <h3>{t('Resumo da Cesta')}</h3>
            <div className="bz-panel-row"><span>Subtotal ({items.length} itens)</span><strong>{formatMoney(subtotal)}</strong></div>
            <div className="bz-panel-row"><span>Impostos (IVA 14%)</span><strong>{formatMoney(iva)}</strong></div>
            <div className="bz-panel-row"><span>Comissão KIXIMA (6,5%)</span><strong>{formatMoney(fee)}</strong></div>
            <div className="bz-panel-row co-total"><span>Total Estimado</span><strong>{formatMoney(total)}</strong></div>
            <button className="btn btn-accent" style={{ width: '100%', marginTop: 12 }} onClick={() => nav('/comprador/checkout')}>Avançar para Checkout →</button>
            <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => nav('/comprador/cotacoes')}><Icon name="invoice" size={14} /> Solicitar Cotação</button>
          </div>
          <div className="bz-panel co-note" style={{ background: '#f3faf4', borderColor: '#cfe8d4', color: '#1c6b2e' }}>
            <Icon name="shield" size={16} /> Compra 100% Segura — todos os dados são protegidos pela KIXIMA.
          </div>
        </div>
      </div>
    </div>
  );
}
