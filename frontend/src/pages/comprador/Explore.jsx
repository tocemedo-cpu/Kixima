// src/pages/comprador/Explore.jsx
// Explorar / Pesquisa — pesquisa de produtos E serviços, ligada 100% à API
// (/api/marketplace). Filtros do banco (categoria, tipo, localização,
// certificações) com contagens, chips de filtros ativos, ordenação, paginação
// no backend, favoritos e "Guardar Pesquisa" persistida. Estética do mockup.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { Icon, Stars } from '../../components/icons';
import ProductCover from '../../components/ProductCover';
import { formatMoney, formatNumber } from '../../domain';
import { useI18n } from '../../i18n';

const SORTS = [
  ['relevantes', 'Mais relevantes'], ['recentes', 'Mais recentes'], ['avaliacao', 'Melhor avaliação'],
  ['preco_asc', 'Menor preço'], ['preco_desc', 'Maior preço'], ['solicitados', 'Mais solicitados'],
];
const KIND_LABEL = { SERVICO: 'Serviço', PRODUTO: 'Produto' };
const cache = new Map();

export default function Explore() {
  const { t } = useI18n();
  const navigate = useNavigate();
  // TODOS os filtros vivem no endereço, e não só `q`.
  //
  // Antes, um comprador que filtrasse por categoria, país e certificação não
  // conseguia mandar aquilo a um colega: o link levava-o à lista sem filtro
  // nenhum. Recarregar a página tinha o mesmo efeito. Numa plataforma de
  // compras, o resultado filtrado É o trabalho — perdê-lo ao partilhar obriga
  // a pessoa do outro lado a repetir os passos de memória.
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(sp.get('q') || '');
  const [pendingQ, setPendingQ] = useState(sp.get('q') || '');
  const [category, setCategory] = useState(sp.get('category') || '');
  const [kind, setKind] = useState(sp.get('kind') || '');
  const [country, setCountry] = useState(sp.get('country') || '');
  const [certs, setCerts] = useState(() => (sp.get('certs') ? sp.get('certs').split(',').filter(Boolean) : []));
  const [sort, setSort] = useState(sp.get('sort') || 'relevantes');
  const [page, setPage] = useState(Number(sp.get('page')) > 0 ? Number(sp.get('page')) : 1);
  const [limit, setLimit] = useState(Number(sp.get('limit')) > 0 ? Number(sp.get('limit')) : 12);

  const [data, setData] = useState(null);
  const [facets, setFacets] = useState({ categories: [], kinds: [], countries: [], certifications: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const firstLoad = useRef(true);

  // Alguém chegou aqui com um `q` diferente (a pesquisa da barra de topo, ou
  // um link colado). Só se sincroniza quando é MESMO diferente: sem essa
  // guarda, este efeito e o que escreve o endereço mais abaixo ficavam a
  // acordar-se um ao outro em ciclo.
  useEffect(() => {
    const urlQ = sp.get('q') || '';
    if (urlQ !== q) { setQ(urlQ); setPendingQ(urlQ); }
  }, [sp]); // eslint-disable-line react-hooks/exhaustive-deps

  // Estado -> endereço. `replace` e não `push`: cada clique num filtro a criar
  // uma entrada no histórico tornava o botão "voltar" do browser inútil — eram
  // precisos dez toques para sair da página.
  useEffect(() => {
    const seguinte = new URLSearchParams();
    if (q) seguinte.set('q', q);
    if (category) seguinte.set('category', category);
    if (kind) seguinte.set('kind', kind);
    if (country) seguinte.set('country', country);
    if (certs.length) seguinte.set('certs', certs.join(','));
    if (sort !== 'relevantes') seguinte.set('sort', sort);
    if (page > 1) seguinte.set('page', String(page));
    if (limit !== 12) seguinte.set('limit', String(limit));
    if (seguinte.toString() !== sp.toString()) setSp(seguinte, { replace: true });
  }, [q, category, kind, country, certs, sort, page, limit]); // eslint-disable-line react-hooks/exhaustive-deps

  const params = useMemo(() => {
    const p = { sort, page, limit };
    if (q) p.q = q;
    if (category) p.category = category;
    if (kind) p.kind = kind;
    if (country) p.country = country;
    if (certs.length) p.certifications = certs.join(',');
    return p;
  }, [q, category, kind, country, certs, sort, page, limit]);

  const load = useCallback(async () => {
    const key = JSON.stringify(params);
    setError('');
    if (cache.has(key)) { setData(cache.get(key)); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await api.get('/api/marketplace/search', params);
      cache.set(key, res);
      setData(res);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [params]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const p = {};
    if (q) p.q = q;
    api.get('/api/marketplace/facets', p).then(setFacets).catch(() => {});
  }, [q]);

  const toggleCert = (c) => { setCerts((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c])); setPage(1); };
  const clearAll = () => { setQ(''); setPendingQ(''); setCategory(''); setKind(''); setCountry(''); setCerts([]); setPage(1); };
  const doSearch = (e) => { e.preventDefault(); setQ(pendingQ); setPage(1); };

  async function toggleFav(p) {
    try {
      if (p.isFavorite) await api.del(`/api/marketplace/favorites/${p.id}`);
      else await api.post('/api/marketplace/favorites', { productId: p.id });
      cache.clear();
      setData((d) => ({ ...d, items: d.items.map((it) => (it.id === p.id ? { ...it, isFavorite: !it.isFavorite } : it)) }));
    } catch (e) { setToast(e.message); }
  }
  async function saveSearch() {
    const qs = new URLSearchParams(params).toString();
    const label = q ? `"${q}"` : 'Pesquisa';
    try { await api.post('/api/marketplace/saved-searches', { label, query: qs }); setToast(t('Pesquisa guardada.')); }
    catch (e) { setToast(e.message); }
    setTimeout(() => setToast(''), 3500);
  }

  // Chips de filtros ativos.
  const chips = [];
  if (kind) chips.push({ k: 'kind', label: KIND_LABEL[kind] ? t(KIND_LABEL[kind]) : kind, clear: () => setKind('') });
  if (q) chips.push({ k: 'q', label: q, clear: () => { setQ(''); setPendingQ(''); } });
  if (category) chips.push({ k: 'cat', label: category, clear: () => setCategory('') });
  if (country) chips.push({ k: 'country', label: country, clear: () => setCountry('') });
  certs.forEach((c) => chips.push({ k: `cert-${c}`, label: c, clear: () => toggleCert(c) }));

  const total = data?.total || 0;
  const pages = data?.pages || 1;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div>
      {toast ? <div className="svc-toast">{toast}</div> : null}
      <div className="svc-crumbs">{t('Home')} <span>›</span> <strong>{t('Explorar / Pesquisa')}</strong></div>
      <h1 className="svc-title">{t('Explorar / Pesquisa')}</h1>

      <form className="exp-searchbar" onSubmit={doSearch}>
        <span className="svc-search-ico"><Icon name="search" size={18} /></span>
        <input value={pendingQ} onChange={(e) => setPendingQ(e.target.value)} placeholder={t('Pesquisar produtos, serviços ou fornecedores…')} />
        <button className="btn btn-accent" type="submit">{t('Pesquisar')}</button>
        <button type="button" className="btn btn-ghost exp-save" onClick={saveSearch}><Icon name="policy" size={14} /> {t('Guardar Pesquisa')}</button>
      </form>

      <div className="svc-count">
        {loading ? t('A carregar…') : <>{q ? `${t('Resultado para')} "${q}"` : t('Resultado')} <span className="exp-total">{formatNumber(total)} {t('resultados')}</span></>}
        <span className="svc-sortwrap">{t('Ordenar por')}{' '}
          <select aria-label={t('Ordenar por')} value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
            {SORTS.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
          </select>
        </span>
      </div>

      {chips.length > 0 && (
        <div className="chip-row">
          {chips.map((c) => (
            <button key={c.k} className="chip" onClick={() => { c.clear(); setPage(1); }}>{c.label} <span>×</span></button>
          ))}
          <button className="chip-clear" onClick={clearAll}>{t('Limpar todos')}</button>
        </div>
      )}

      <div className="svc-layout">
        <aside className="svc-filters">
          <div className="flt-head"><strong>{t('Filtrar Resultados')}</strong><button className="flt-clear" onClick={clearAll}>{t('Limpar filtros')}</button></div>

          <div className="flt-group">
            <div className="flt-title">{t('Categoria')}</div>
            {facets.categories.map((c) => (
              <label key={c.name} className="flt-check">
                <input type="checkbox" checked={category === c.name} onChange={() => { setCategory(category === c.name ? '' : c.name); setPage(1); }} />
                <span className="flt-lbl">{c.name}</span><span className="flt-num">({c.count})</span>
              </label>
            ))}
          </div>

          <div className="flt-group">
            <div className="flt-title">{t('Tipo')}</div>
            {facets.kinds.map((kd) => (
              <label key={kd.name} className="flt-check">
                <input type="checkbox" checked={kind === kd.name} onChange={() => { setKind(kind === kd.name ? '' : kd.name); setPage(1); }} />
                <span className="flt-lbl">{KIND_LABEL[kd.name] ? t(KIND_LABEL[kd.name]) : kd.name}</span><span className="flt-num">({kd.count})</span>
              </label>
            ))}
          </div>

          <div className="flt-group">
            <div className="flt-title">{t('Localização')}</div>
            {facets.countries.map((c) => (
              <label key={c.name} className="flt-check">
                <input type="checkbox" checked={country === c.name} onChange={() => { setCountry(country === c.name ? '' : c.name); setPage(1); }} />
                <span className="flt-lbl">{c.name}</span><span className="flt-num">({c.count})</span>
              </label>
            ))}
            {facets.countries.length === 0 ? <p className="helptext" style={{ margin: 0 }}>—</p> : null}
          </div>

          <div className="flt-group">
            <div className="flt-title">{t('Certificações')}</div>
            {facets.certifications.map((c) => (
              <label key={c.name} className="flt-check">
                <input type="checkbox" checked={certs.includes(c.name)} onChange={() => toggleCert(c.name)} />
                <span className="flt-lbl">{c.name}</span><span className="flt-num">({c.count})</span>
              </label>
            ))}
          </div>
        </aside>

        <div>
          {error ? (
            <div className="empty-state"><h3>{t('Não foi possível carregar')}</h3><p>{error}</p><button className="btn btn-accent" onClick={load}>{t('Tentar de novo')}</button></div>
          ) : loading ? (
            <div className="svc-grid">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="svc-card svc-skel" />)}</div>
          ) : total === 0 ? (
            <div className="empty-state"><h3>{t('Nenhum resultado')}</h3><p>{t('Ajuste a pesquisa ou os filtros.')}</p></div>
          ) : (
            <>
              <div className="svc-grid">
                {data.items.map((p) => <ExploreCard key={p.id} p={p} onFav={toggleFav} onOpen={() => navigate(`/comprador/servicos/${p.slug || p.id}`)} />)}
              </div>
              <div className="svc-pag">
                <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((x) => x - 1)}>← {t('Anterior')}</button>
                {pageNumbers(page, pages).map((n, i) => n === '…'
                  ? <span key={`e${i}`} className="svc-ellipsis">…</span>
                  : <button key={n} className={`svc-pagn${n === page ? ' on' : ''}`} onClick={() => setPage(n)}>{n}</button>)}
                <button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => setPage((x) => x + 1)}>{t('Próximo')} →</button>
                <span className="exp-perpage">{t('Resultados por página')}{' '}
                  <select aria-label={t('Resultados por página')} value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}>
                    {[12, 24, 48].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';
}

function ExploreCard({ p, onFav, onOpen }) {
  const { t } = useI18n();
  return (
    <div className="exp-card">
      <div className="exp-media" onClick={onOpen} role="button" tabIndex={0}>
        <ProductCover imageUrl={p.imageUrl} category={p.category} name={p.name} caption={false} />
        <span className="exp-kind">{KIND_LABEL[p.kind] ? t(KIND_LABEL[p.kind]) : ''}</span>
      </div>
      <div className="exp-top">
        <span className="exp-logo">{p.supplier?.logoUrl ? <img src={p.supplier.logoUrl} alt={p.supplier.name} /> : initials(p.supplier?.name)}</span>
        <button className={`svc-fav${p.isFavorite ? ' on' : ''}`} onClick={() => onFav(p)} aria-label={t('Favorito')}>♥</button>
      </div>
      <strong className="svc-name" onClick={onOpen}>{p.name}</strong>
      <div className="svc-company">{p.supplier?.name}</div>
      <div className="svc-ratingrow">
        <Stars value={p.rating || 0} /> <span className="svc-ratenum">{p.rating ? p.rating.toFixed(1) : '—'} {p.reviewCount ? `(${p.reviewCount} ${t('avaliações')})` : ''}</span>
        {p.supplier?.verified ? <span className="svc-verified">KIXIMA Verified</span> : null}
      </div>
      <p className="svc-desc">{p.description}</p>
      <div className="svc-metarow">
        <span><Icon name="offshore" size={13} /> {[p.city, p.country].filter(Boolean).join(', ') || '—'}</span>
        {p.leadTimeDays ? <span>{t('Prazo')} {p.leadTimeDays} {t('dias')}</span> : null}
      </div>
      <div className="exp-foot">
        <div><div className="exp-fromlbl">{t('A partir de')}</div><div className="exp-price">{formatMoney(p.promoPrice || p.unitPrice, p.currency)}</div></div>
        <button className="btn btn-accent btn-sm" onClick={onOpen}>{t('Ver Detalhes')}</button>
      </div>
    </div>
  );
}

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
