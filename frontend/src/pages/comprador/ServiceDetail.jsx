// src/pages/comprador/ServiceDetail.jsx
// Detalhe de um serviço (rota /comprador/servicos/:slug) — dados reais pela API,
// avaliações reais e ações (favorito, solicitar cotação, avaliar).
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { Loading, ErrorBanner, SuccessBanner } from '../../components/Common';
import { Icon, Stars } from '../../components/icons';
import ProductCover from '../../components/ProductCover';
import { formatMoney, formatDate } from '../../domain';
import { useI18n } from '../../i18n';

export default function ServiceDetail() {
  const { t } = useI18n();
  const { slug } = useParams();
  const navigate = useNavigate();
  const [p, setP] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  function loadReviews(id) { api.get(`/api/catalog/${id}/reviews`).then(setReviews).catch(() => {}); }
  useEffect(() => {
    api.get(`/api/catalog/slug/${slug}`).then((prod) => { setP(prod); loadReviews(prod.id); }).catch((e) => setError(e.message));
  }, [slug]);

  if (error) return <ErrorBanner message={error} />;
  if (!p) return <Loading />;

  async function quote() {
    try { await api.post('/api/quotes', { supplierCompanyId: p.supplier?.id, items: [{ productId: p.id, quantity: 1 }] }); setMsg(t('Pedido de cotação enviado.')); }
    catch (e) { setError(e.message); }
  }
  async function submitReview(e) {
    e.preventDefault();
    try { await api.post(`/api/catalog/${p.id}/reviews`, { rating: Number(rating), comment: comment || undefined }); setMsg(t('Avaliação registada.')); setComment(''); loadReviews(p.id); const fresh = await api.get(`/api/catalog/slug/${slug}`); setP(fresh); }
    catch (e) { setError(e.message); }
  }

  return (
    <div>
      <button className="btn btn-ghost btn-sm" style={{ marginBottom: 14 }} onClick={() => navigate('/comprador/servicos')}>← {t('Voltar aos serviços')}</button>
      <SuccessBanner message={msg} />

      <div className="grid-cols grid-2" style={{ alignItems: 'start' }}>
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="detail-cover"><ProductCover imageUrl={p.imageUrl} category={p.category} name={p.name} /></div>
          <div className="card-pad">
            <span className="badge badge-neutral">{p.category}</span>
            {p.specialty ? <span className="badge badge-neutral" style={{ marginLeft: 6 }}>{p.specialty}</span> : null}
            <h1 style={{ fontSize: 22, marginTop: 12 }}>{p.name}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <Stars value={p.rating || 0} /> <span style={{ fontSize: 13, color: 'var(--ink-600)' }}>{p.rating ? p.rating.toFixed(1) : '—'} {p.reviewCount ? `(${p.reviewCount} ${t('avaliações')})` : ''}</span>
              {p.supplier?.verified ? <span className="svc-verified">{t('Verificado')}</span> : null}
            </div>
            <p style={{ fontSize: 14, color: 'var(--ink-600)', marginTop: 12, lineHeight: 1.6 }}>{p.fullDescription || p.description || t('Sem descrição.')}</p>
            <div style={{ marginTop: 16, display: 'grid', gap: 8, fontSize: 13.5 }}>
              <Row label={t('Fornecedor')}>{p.supplier?.name}</Row>
              <Row label={t('Localização')}>{[p.city, p.province, p.country].filter(Boolean).join(', ') || '—'}</Row>
              {p.leadTimeDays ? <Row label={t('Prazo')}>{p.leadTimeDays} {t('dias')}</Row> : null}
              {p.availability ? <Row label={t('Disponibilidade')}>{p.availability}</Row> : null}
              {p.certifications?.length ? <Row label={t('Certificações')}>{p.certifications.join(', ')}</Row> : null}
            </div>
          </div>
        </div>

        <div>
          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <div className="stat-label">{t('Preço')}</div>
            <div className="stat-value" style={{ fontFamily: 'var(--font-mono)' }}>{formatMoney(p.unitPrice, p.currency)}</div>
            <button className="btn btn-accent" style={{ width: '100%', marginTop: 16 }} onClick={quote}>{t('Solicitar Cotação')}</button>
          </div>

          <div className="card card-pad">
            <strong style={{ fontSize: 13.5 }}>{t('Avaliações')}</strong>
            <form onSubmit={submitReview} style={{ margin: '12px 0', display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="field" style={{ margin: 0, width: 90 }}>
                <label>{t('Nota')}</label>
                <select value={rating} onChange={(e) => setRating(e.target.value)}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}</select>
              </div>
              <div className="field" style={{ margin: 0, flex: 1 }}><label>{t('Comentário')}</label><input value={comment} onChange={(e) => setComment(e.target.value)} /></div>
              <button className="btn btn-ghost btn-sm" type="submit">{t('Avaliar')}</button>
            </form>
            {reviews.length === 0 ? <p className="helptext" style={{ margin: 0 }}>{t('Ainda sem avaliações.')}</p> : (
              <div style={{ display: 'grid', gap: 10 }}>
                {reviews.map((r) => (
                  <div key={r.id} style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><Stars value={r.rating} /><span style={{ fontSize: 12, color: 'var(--ink-400)' }}>{formatDate(r.createdAt)}</span></div>
                    <div style={{ fontSize: 13 }}>{r.user?.name}</div>
                    {r.comment ? <p style={{ fontSize: 13, color: 'var(--ink-600)', margin: '2px 0 0' }}>{r.comment}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color: 'var(--ink-400)' }}>{label}</span><span style={{ textAlign: 'right' }}>{children}</span></div>;
}
