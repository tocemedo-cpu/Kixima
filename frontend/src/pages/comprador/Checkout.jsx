// src/pages/comprador/Checkout.jsx
// Checkout (item 5) — revê a cesta agrupada por fornecedor e gera uma Ordem de
// Compra (PO) por fornecedor via POST /api/purchase-orders.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { Crumbs, PageHead } from '../../components/BuyerUI';
import { Icon } from '../../components/icons';
import { IVA_RATE, formatMoney } from '../../domain';
import { useCart } from './CartContext';
import { useI18n } from '../../i18n';

export default function Checkout() {
  const { t } = useI18n();
  const { items, removeItem } = useCart();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  const groups = useMemo(() => {
    const map = new Map();
    items.forEach((it) => {
      const sid = it.product.supplierId;
      if (!map.has(sid)) map.set(sid, { supplier: it.product.supplier, items: [] });
      map.get(sid).items.push(it);
    });
    return Array.from(map.values());
  }, [items]);

  const subtotal = items.reduce((s, i) => s + Number(i.product.unitPrice) * i.quantity, 0);
  const iva = subtotal * IVA_RATE;
  const total = subtotal + iva;

  async function confirm() {
    setBusy(true); setError('');
    const created = [];
    try {
      for (const g of groups) {
        const po = await api.post('/api/purchase-orders', {
          supplierCompanyId: g.supplier.id,
          items: g.items.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
        });
        created.push(po.reference);
      }
      items.forEach((i) => removeItem(i.product.id));
      setDone(created);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  if (done) {
    return (
      <div>
        <Crumbs trail={['Home', 'Minha Cesta', 'Checkout']} />
        <div className="empty-state">
          <div className="pf-avatar" style={{ margin: '0 auto 14px', background: '#16a066' }}><Icon name="reception" size={26} /></div>
          <h3>{done.length} {done.length === 1 ? t('Ordem de Compra gerada') : t('Ordens de Compra geradas')}</h3>
          <p>{t('Referências')}: {done.join(', ')}. {t('Cada fornecedor recebeu uma PO distinta.')}</p>
          <button className="btn btn-accent" onClick={() => nav('/comprador/ordens')}>{t('Ver Ordens de Compra')}</button>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div>
        <Crumbs trail={['Home', 'Minha Cesta', 'Checkout']} />
        <div className="empty-state"><h3>{t('A sua cesta está vazia')}</h3><p>{t('Adicione itens antes de finalizar a compra.')}</p>
          <button className="btn btn-accent" onClick={() => nav('/comprador/catalogo')}>{t('Explorar catálogo')}</button></div>
      </div>
    );
  }

  return (
    <div>
      <Crumbs trail={['Home', 'Minha Cesta', 'Checkout']} />
      <PageHead title="Checkout" subtitle="Revise os itens e confirme a sua compra." />

      <div className="co-banner"><Icon name="shield" size={16} /> {t('Os itens estão agrupados por fornecedor. Cada fornecedor receberá uma Ordem de Compra (PO) diferente.')}</div>
      {error ? <div className="empty-state" style={{ padding: 16 }}><p>{error}</p></div> : null}

      <div className="bz-layout">
        <div>
          <h3 className="pf-h2">{t('Fornecedores e Itens')} <span className="bz-muted">({t('{a} itens de {b} fornecedores', { a: items.length, b: groups.length })})</span></h3>
          {groups.map((g) => {
            const gtotal = g.items.reduce((s, i) => s + Number(i.product.unitPrice) * i.quantity, 0);
            return (
              <div className="bz-card co-group" key={g.supplier.id}>
                <div className="co-grouphead">
                  <div className="bz-supplier">
                    <span className="bz-supplier-logo">{(g.supplier.name || '?').slice(0, 2).toUpperCase()}</span>
                    <div><strong>{g.supplier.name}</strong>{g.supplier.verified ? <span className="svc-verified" style={{ marginLeft: 6 }}>{t('Fornecedor Verificado')}</span> : null}</div>
                  </div>
                  <div className="co-grouptotal"><span className="bz-muted">{t('Subtotal do Fornecedor')}</span><strong>{formatMoney(gtotal)}</strong></div>
                </div>
                {g.items.map((it) => (
                  <div className="co-line" key={it.product.id}>
                    <span>{it.quantity}× {it.product.name}<span className="bz-sub2">SKU: {it.product.sku || '—'}</span></span>
                    <strong>{formatMoney(Number(it.product.unitPrice) * it.quantity)}</strong>
                  </div>
                ))}
              </div>
            );
          })}
          <button className="btn btn-ghost" onClick={() => nav('/comprador/cesta')}>← {t('Voltar para a Cesta')}</button>
        </div>

        <div className="bz-side">
          <div className="bz-panel">
            <h3>{t('Resumo do Checkout')}</h3>
            <div className="bz-muted" style={{ marginBottom: 6 }}>{t('Resumo por Fornecedor')}</div>
            {groups.map((g) => {
              const gt = g.items.reduce((s, i) => s + Number(i.product.unitPrice) * i.quantity, 0);
              return <div className="bz-panel-row" key={g.supplier.id}><span>{g.supplier.name}</span><strong>{formatMoney(gt)}</strong></div>;
            })}
            <hr className="co-hr" />
            <div className="bz-panel-row"><span>{t('Subtotal')} ({items.length} {t('itens')})</span><strong>{formatMoney(subtotal)}</strong></div>
            <div className="bz-panel-row"><span>{t('Impostos (IVA 14%)')}</span><strong>{formatMoney(iva)}</strong></div>
            <div className="bz-panel-row co-total"><span>{t('Total Estimado')}</span><strong>{formatMoney(total)}</strong></div>
            <div className="co-note"><Icon name="shield" size={14} /> {t('Serão geradas')} {groups.length} {groups.length === 1 ? t('Ordem de Compra') : t('Ordens de Compra')} (PO). {t('Uma para cada fornecedor.')}</div>
            <button className="btn btn-accent" style={{ width: '100%', marginTop: 12 }} disabled={busy} onClick={confirm}>
              {busy ? t('A gerar…') : <>{t('Continuar para o Pagamento')} →</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
