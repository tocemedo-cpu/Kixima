// src/pages/comprador/ItemDetail.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/client';
import { Loading, ErrorBanner } from '../../components/Common';
import { formatMoney } from '../../domain';
import { useCart } from './CartContext';

export default function ItemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const { addItem } = useCart();

  useEffect(() => {
    api.get(`/api/catalog/${id}`).then(setProduct).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <ErrorBanner message={error} />;
  if (!product) return <Loading />;

  function handleAdd() {
    addItem(product, quantity);
    setAdded(true);
  }

  return (
    <div>
      <button className="btn btn-ghost btn-sm" style={{ marginBottom: 14 }} onClick={() => navigate('/comprador/catalogo')}>
        ← Voltar ao catálogo
      </button>

      <div className="grid-cols grid-2" style={{ alignItems: 'start' }}>
        <div className="card card-pad">
          <span className="badge badge-neutral">{product.category}</span>
          <h1 style={{ fontSize: 22, marginTop: 12 }}>{product.name}</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-600)', marginTop: 10, lineHeight: 1.6 }}>
            {product.description || 'Sem descrição adicional.'}
          </p>

          <div style={{ marginTop: 20, display: 'grid', gap: 10, fontSize: 13.5 }}>
            <Row label="Fornecedor">{product.supplier?.name}</Row>
            {product.leadTimeDays ? <Row label="Prazo de entrega">{product.leadTimeDays} dias</Row> : null}
          </div>
        </div>

        <div className="card card-pad">
          <div className="stat-label">Preço unitário</div>
          <div className="stat-value" style={{ fontFamily: 'var(--font-mono)' }}>{formatMoney(product.unitPrice, product.currency)}</div>

          <div className="field" style={{ marginTop: 20 }}>
            <label>Quantidade</label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => {
                setQuantity(Math.max(1, Number(e.target.value)));
                setAdded(false);
              }}
              style={{ maxWidth: 120 }}
            />
          </div>

          <div style={{ fontSize: 13, color: 'var(--ink-600)', marginBottom: 16 }}>
            Subtotal: <strong>{formatMoney(Number(product.unitPrice) * quantity, product.currency)}</strong>
          </div>

          <button className="btn btn-accent" style={{ width: '100%' }} onClick={handleAdd}>
            {added ? 'Adicionado à cesta ✓' : 'Adicionar à cesta'}
          </button>
          {added ? (
            <Link to="/comprador/cesta" className="btn btn-ghost btn-sm" style={{ width: '100%', marginTop: 10, justifyContent: 'center' }}>
              Ver cesta
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ color: 'var(--ink-400)' }}>{label}</span>
      <span>{children}</span>
    </div>
  );
}
