// src/pages/comprador/ItemDetail.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/client';
import { Loading, ErrorBanner , Field } from '../../components/Common';
import { formatMoney } from '../../domain';
import { useCart } from './CartContext';
import ProductCover from '../../components/ProductCover';
import { useI18n } from '../../i18n';

const DOC_LABELS = {
  FICHA_TECNICA: 'Ficha Técnica', DATASHEET: 'Datasheet', MANUAL: 'Manual',
  CATALOGO: 'Catálogo PDF', CERTIFICADO: 'Certificado', DESENHO_TECNICO: 'Desenho Técnico',
};
const SPEC_FIELDS = [
  ['material', 'Material'], ['weight', 'Peso'], ['height', 'Altura'], ['width', 'Largura'],
  ['length', 'Comprimento'], ['pressure', 'Pressão'], ['temperature', 'Temperatura'],
  ['power', 'Potência'], ['voltage', 'Tensão'], ['measurementUnit', 'Unidade de Medida'],
];
const IDENT_FIELDS = [
  ['brand', 'Marca'], ['manufacturer', 'Fabricante'], ['model', 'Modelo'],
  ['sku', 'SKU'], ['manufacturerCode', 'Código do Fabricante'], ['countryOfOrigin', 'País de Origem'],
];

export default function ItemDetail() {
  const { t } = useI18n();
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [activeImg, setActiveImg] = useState(null);
  const { addItem } = useCart();

  useEffect(() => {
    api.get(`/api/catalog/${id}`).then((p) => { setProduct(p); setActiveImg(p.imageUrl || null); }).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <ErrorBanner message={error} />;
  if (!product) return <Loading />;

  function handleAdd() {
    addItem(product, quantity);
    setAdded(true);
  }

  const specs = SPEC_FIELDS.filter(([k]) => product[k]);
  const idents = IDENT_FIELDS.filter(([k]) => product[k]);
  const gallery = product.images || [];
  const docs = product.documents || [];
  const hasPromo = product.promoPrice != null && Number(product.promoPrice) > 0;

  return (
    <div>
      <button className="btn btn-ghost btn-sm" style={{ marginBottom: 14 }} onClick={() => navigate('/comprador/catalogo')}>
        ← {t('Voltar ao catálogo')}
      </button>

      <div className="grid-cols grid-2" style={{ alignItems: 'start' }}>
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="detail-cover">
            <ProductCover imageUrl={activeImg} category={product.category} name={product.name} />
          </div>
          {gallery.length > 1 && (
            <div className="dz-grid" style={{ padding: '12px 16px 0' }}>
              {gallery.map((img) => (
                <button key={img.id} type="button" className="dz-item" style={{ cursor: 'pointer', border: activeImg === img.url ? '2px solid var(--brand-600)' : '1px solid var(--line)' }} onClick={() => setActiveImg(img.url)}>
                  <img src={img.url} alt={product.name} />
                </button>
              ))}
            </div>
          )}
          <div className="card-pad">
          <span className="badge badge-neutral">{product.category}</span>
          {product.subcategory ? <span className="badge badge-neutral" style={{ marginLeft: 6 }}>{product.subcategory}</span> : null}
          <h1 style={{ fontSize: 22, marginTop: 12 }}>{product.name}</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-600)', marginTop: 10, lineHeight: 1.6 }}>
            {product.fullDescription || product.description || t('Sem descrição adicional.')}
          </p>

          {product.applications ? <DescBlock title={t('Aplicações')}>{product.applications}</DescBlock> : null}
          {product.benefits ? <DescBlock title={t('Benefícios')}>{product.benefits}</DescBlock> : null}

          <div style={{ marginTop: 20, display: 'grid', gap: 10, fontSize: 13.5 }}>
            <Row label={t('Fornecedor')}>{product.supplier?.name}</Row>
            {idents.map(([k, label]) => <Row key={k} label={t(label)}>{product[k]}</Row>)}
            {product.leadTimeDays ? <Row label={t('Prazo de entrega')}>{product.leadTimeDays} {t('dias')}</Row> : null}
            {product.availability ? <Row label={t('Disponibilidade')}>{product.availability}</Row> : null}
            {product.warehouse ? <Row label={t('Armazém')}>{product.warehouse}</Row> : null}
          </div>

          {specs.length > 0 && (
            <>
              <div className="reg-section">{t('Especificações técnicas')}</div>
              <div style={{ display: 'grid', gap: 10, fontSize: 13.5 }}>
                {specs.map(([k, label]) => <Row key={k} label={t(label)}>{product[k]}</Row>)}
              </div>
            </>
          )}

          {docs.length > 0 && (
            <>
              <div className="reg-section">{t('Documentos')}</div>
              <div className="doc-list">
                {docs.map((d) => (
                  <a key={d.id} className="doc-item" href={d.fileUrl} target="_blank" rel="noreferrer">
                    <span>{DOC_LABELS[d.type] ? t(DOC_LABELS[d.type]) : d.type}</span>
                    <span className="doc-name">{d.originalName}</span>
                  </a>
                ))}
              </div>
            </>
          )}
          </div>
        </div>

        <div className="card card-pad">
          <div className="stat-label">{t('Preço unitário')}</div>
          {hasPromo ? (
            <div>
              <div className="stat-value" style={{ fontFamily: 'var(--font-mono)', color: 'var(--brand-600)' }}>{formatMoney(product.promoPrice, product.currency)}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-400)', textDecoration: 'line-through' }}>{formatMoney(product.unitPrice, product.currency)}</div>
            </div>
          ) : (
            <div className="stat-value" style={{ fontFamily: 'var(--font-mono)' }}>{formatMoney(product.unitPrice, product.currency)}</div>
          )}
          {(product.minQuantity || product.maxQuantity) ? (
            <div style={{ fontSize: 12.5, color: 'var(--ink-600)', marginTop: 6 }}>
              {product.minQuantity ? `${t('Mín.')} ${product.minQuantity}` : ''}{product.minQuantity && product.maxQuantity ? ' · ' : ''}{product.maxQuantity ? `${t('Máx.')} ${product.maxQuantity}` : ''} {t('unidades')}
            </div>
          ) : null}

          <Field label={t('Quantidade')} style={{ marginTop: 20 }}>
            {(id) => (<>
              <input id={id}
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => {
                  setQuantity(Math.max(1, Number(e.target.value)));
                  setAdded(false);
                }}
                style={{ maxWidth: 120 }}
              />
            </>)}
          </Field>

          <div style={{ fontSize: 13, color: 'var(--ink-600)', marginBottom: 16 }}>
            {t('Subtotal')}: <strong>{formatMoney(Number(product.unitPrice) * quantity, product.currency)}</strong>
          </div>

          <button className="btn btn-accent" style={{ width: '100%' }} onClick={handleAdd}>
            {added ? t('Adicionado à cesta ✓') : t('Adicionar à cesta')}
          </button>
          <Link to={`/comprador/comparar?productId=${product.id}`} className="btn btn-ghost btn-sm" style={{ width: '100%', marginTop: 10, justifyContent: 'center' }}>
            ⇄ {t('Comparar fornecedores')}
          </Link>
          {added ? (
            <Link to="/comprador/cesta" className="btn btn-ghost btn-sm" style={{ width: '100%', marginTop: 10, justifyContent: 'center' }}>
              {t('Ver cesta')}
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
      <span style={{ textAlign: 'right' }}>{children}</span>
    </div>
  );
}

function DescBlock({ title, children }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 4 }}>{title}</div>
      <p style={{ fontSize: 13.5, color: 'var(--ink-600)', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-line' }}>{children}</p>
    </div>
  );
}
