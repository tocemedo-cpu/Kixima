// src/pages/comprador/Services.jsx
// Marketplace de Serviços — 100% funcional a partir da API real
// (/api/marketplace). Pesquisa em tempo real, filtros do banco, paginação no
// backend, favoritos persistidos e avaliações reais. Skeleton + estados de
// erro/vazio. Estética alinhada com o mockup aprovado.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import ProductCover from '../../components/ProductCover';
import { Icon, Stars } from '../../components/icons';
import { formatMoney } from '../../domain';
import { useI18n } from '../../i18n';

const SORTS = [
  ['relevantes', 'Mais Relevantes'], ['recentes', 'Mais recentes'], ['avaliacao', 'Melhor avaliação'],
  ['preco_asc', 'Menor preço'], ['preco_desc', 'Maior preço'], ['solicitados', 'Mais solicitados'], ['vendidos', 'Mais vendidos'],
];
const CERTS = ['ISO 9001', 'ISO 45001', 'ISO 14001', 'API Q1 / Q2'];
const EXEC = [['', 'Todos'], ['7', 'Até 7 dias'], ['30', '7 - 30 dias'], ['90', '30 - 90 dias'], ['999', 'Mais de 90 dias']];

// Cache simples em memória por query-string (evita refetch — pedido de "cache").
const cache = new Map();

export default function Services() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [qDebounced, setQDebounced] = useState(searchParams.get('q') || '');

  // Sincroniza a pesquisa com o ?q= da navbar global.
  useEffect(() => { setQ(searchParams.get('q') || ''); }, [searchParams]);
  const [category, setCategory] = useState('');
  const [certs, setCerts] = useState([]);
  const [verified, setVerified] = useState(false);
  const [country, setCountry] = useState('');
  const [sort, setSort] = useState('relevantes');
  const [page, setPage] = useState(1);

  const [data, setData] = useState(null);
  const [facets, setFacets] = useState({ categories: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const abortRef = useRef(null);

  // Debounce da pesquisa (tempo real, sem martelar a API).
  useEffect(() => {
    const t = setTimeout(() => { setQDebounced(q); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const params = useMemo(() => {
    const p = { kind: 'SERVICO', sort, page, limit: 16 };
    if (qDebounced) p.q = qDebounced;
    if (category) p.category = category;
    if (certs.length) p.certifications = certs.join(',');
    if (verified) p.verified = 'true';
    if (country) p.country = country;
    return p;
  }, [qDebounced, category, certs, verified, country, sort, page]);

  const load = useCallback(async () => {
    const key = JSON.stringify(params);
    setError('');
    if (cache.has(key)) { setData(cache.get(key)); setLoading(false); return; }
    setLoading(true);
    if (abortRef.current) abortRef.current = null;
    try {
      const res = await api.get('/api/marketplace/search', params);
      cache.set(key, res);
      setData(res);
    } catch (e) {
      setError(e.message || t('Falha ao carregar serviços.'));
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { load(); }, [load]);

  // Facetas (contagem por categoria) — reagem à pesquisa/filtros base.
  useEffect(() => {
    const p = { kind: 'SERVICO' };
    if (qDebounced) p.q = qDebounced;
    if (verified) p.verified = 'true';
    if (country) p.country = country;
    api.get('/api/marketplace/facets', p).then(setFacets).catch(() => {});
  }, [qDebounced, verified, country]);

  const toggleCert = (c) => { setCerts((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c])); setPage(1); };
  const clearFilters = () => { setCategory(''); setCerts([]); setVerified(false); setCountry(''); setQ(''); setPage(1); };

  async function toggleFav(p) {
    try {
      if (p.isFavorite) await api.del(`/api/marketplace/favorites/${p.id}`);
      else await api.post('/api/marketplace/favorites', { productId: p.id });
      // atualiza localmente + invalida cache
      cache.clear();
      setData((d) => ({ ...d, items: d.items.map((it) => (it.id === p.id ? { ...it, isFavorite: !it.isFavorite } : it)) }));
    } catch (e) { setToast(e.message); }
  }

  async function solicitarCotacao(p) {
    try {
      await api.post('/api/quotes', { supplierCompanyId: p.supplier?.id, items: [{ productId: p.id, quantity: 1 }] });
      setToast(t('Pedido de cotação enviado a {name}.', { name: p.supplier?.name || t('fornecedor') }));
    } catch (e) { setToast(e.message); }
    setTimeout(() => setToast(''), 4000);
  }

  const total = data?.total || 0;
  const pages = data?.pages || 1;
  const from = total === 0 ? 0 : (page - 1) * 16 + 1;
  const to = Math.min(page * 16, total);

  return (
    <div>
      {toast ? <div className="svc-toast">{toast}</div> : null}

      <div className="svc-crumbs">{t('Home')} <span>›</span> {t('Catálogo')} <span>›</span> <strong>{t('Serviços')}</strong></div>
      <h1 className="svc-title">{t('Serviços')}</h1>

      {/* Barra de pesquisa + ações */}
      <div className="svc-searchbar">
        <span className="svc-search-ico"><Icon name="search" size={18} /></span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Pesquisar serviços por nome, categoria, especialidade…')} />
      </div>

      <div className="svc-count">
        {loading ? t('A carregar…') : t('Mostrando {a} - {b} de {n} serviços', { a: from, b: to, n: total.toLocaleString('pt-PT') })}
        <span className="svc-sortwrap">
          {t('Ordenar por')}{' '}
          <select aria-label={t('Ordenar por')} value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
            {SORTS.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
          </select>
        </span>
      </div>

      <div className="svc-layout">
        {/* Filtros */}
        <aside className="svc-filters">
          <div className="flt-group">
            <div className="flt-title">{t('Categorias')}</div>
            <button className={`flt-cat${!category ? ' on' : ''}`} onClick={() => { setCategory(''); setPage(1); }}>{t('Todas')}</button>
            {facets.categories.map((c) => (
              <button key={c.name} className={`flt-cat${category === c.name ? ' on' : ''}`} onClick={() => { setCategory(c.name); setPage(1); }}>
                <span>{c.name}</span><span className="flt-num">{c.count}</span>
              </button>
            ))}
          </div>

          <div className="flt-group">
            <div className="flt-title">{t('Localização')}</div>
            {['Angola', 'Brasil', 'África do Sul', 'Emirados Árabes'].map((c) => (
              <label key={c} className="flt-check">
                <input type="radio" name="country" checked={country === c} onChange={() => { setCountry(c); setPage(1); }} /> {t(c)}
              </label>
            ))}
            <label className="flt-check"><input type="radio" name="country" checked={country === ''} onChange={() => { setCountry(''); setPage(1); }} /> {t('Todos')}</label>
          </div>

          <div className="flt-group">
            <div className="flt-title">{t('Fornecedor Verificado')}</div>
            <label className="flt-check"><input type="checkbox" checked={verified} onChange={(e) => { setVerified(e.target.checked); setPage(1); }} /> {t('Apenas Fornecedores Verificados')}</label>
          </div>

          <div className="flt-group">
            <div className="flt-title">{t('Certificações')}</div>
            {CERTS.map((c) => (
              <label key={c} className="flt-check"><input type="checkbox" checked={certs.includes(c)} onChange={() => toggleCert(c)} /> {c}</label>
            ))}
          </div>

          <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={clearFilters}>{t('Limpar Filtros')}</button>
        </aside>

        {/* Resultados */}
        <div>
          {error ? (
            <div className="empty-state">
              <h3>{t('Não foi possível carregar')}</h3><p>{error}</p>
              <button className="btn btn-accent" onClick={load}>{t('Tentar de novo')}</button>
            </div>
          ) : loading ? (
            <div className="svc-grid">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="svc-card svc-skel" />)}</div>
          ) : total === 0 ? (
            <div className="empty-state"><h3>{t('Nenhum serviço encontrado')}</h3><p>{t('Ajuste a pesquisa ou os filtros.')}</p></div>
          ) : (
            <>
              <div className="svc-grid">
                {data.items.map((p) => <ServiceCard key={p.id} p={p} onFav={toggleFav} onQuote={solicitarCotacao} onOpen={() => navigate(`/comprador/servicos/${p.slug || p.id}`)} />)}
              </div>

              <div className="svc-pag">
                <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← {t('Anterior')}</button>
                {pageNumbers(page, pages).map((n, i) => n === '…'
                  ? <span key={`e${i}`} className="svc-ellipsis">…</span>
                  : <button key={n} className={`svc-pagn${n === page ? ' on' : ''}`} onClick={() => setPage(n)}>{n}</button>)}
                <button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>{t('Próximo')} →</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ServiceCard({ p, onFav, onQuote, onOpen }) {
  const { t } = useI18n();
  const avail = p.availability || t('Disponível');
  const availClass = /sob/i.test(avail) ? 'sobconsulta' : 'disponivel';
  return (
    <div className="svc-card">
      <div className="svc-card-img">
        <ProductCover imageUrl={p.imageUrl} category={p.category} name={p.name} caption={false} />
        <span className={`svc-avail ${availClass}`}>{avail}</span>
        <button className={`svc-fav${p.isFavorite ? ' on' : ''}`} onClick={() => onFav(p)} aria-label={t('Favorito')}>♥</button>
      </div>
      <div className="svc-card-body">
        <div className="svc-company">{p.supplier?.name}</div>
        <strong className="svc-name" onClick={onOpen}>{p.name}</strong>
        <p className="svc-desc">{p.description}</p>
        <div className="svc-metarow">
          <span><Icon name="offshore" size={13} /> {[p.city, p.country].filter(Boolean).join(', ') || '—'}</span>
          {p.leadTimeDays ? <span>{t('Prazo')} {p.leadTimeDays} {t('dias')}</span> : null}
        </div>
        <div className="svc-ratingrow">
          <Stars value={p.rating || 0} /> <span className="svc-ratenum">{p.rating ? p.rating.toFixed(1) : '—'} {p.reviewCount ? `(${p.reviewCount})` : ''}</span>
          {p.supplier?.verified ? <span className="svc-verified">{t('Verificado')}</span> : null}
        </div>
        <div className="svc-actions">
          <button className="btn btn-ghost btn-sm" onClick={onOpen}>{t('Ver Detalhes')}</button>
          <button className="btn btn-accent btn-sm" onClick={() => onQuote(p)}>{t('Solicitar Cotação')}</button>
        </div>
      </div>
    </div>
  );
}

// [1,2,3,4,5,…,N] com reticências.
function pageNumbers(cur, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out = [1];
  const s = Math.max(2, cur - 1), e = Math.min(total - 1, cur + 1);
  if (s > 2) out.push('…');
  for (let i = s; i <= e; i++) out.push(i);
  if (e < total - 1) out.push('…');
  out.push(total);
  return out;
}
