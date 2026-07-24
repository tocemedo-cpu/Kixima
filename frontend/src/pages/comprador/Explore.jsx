// src/pages/comprador/Explore.jsx
// Explorar / Pesquisa — pesquisa de produtos E serviços, ligada 100% à API
// (/api/marketplace). Filtros do banco (categoria, tipo, localização,
// certificações) com contagens, chips de filtros ativos, ordenação, paginação
// no backend, favoritos e "Guardar Pesquisa" persistida. Estética do mockup.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { Icon, Stars } from '../../components/icons';
import { formatMoney } from '../../domain';

const SORTS = [
  ['relevantes', 'Mais relevantes'], ['recentes', 'Mais recentes'], ['avaliacao', 'Melhor avaliação'],
  ['preco_asc', 'Menor preço'], ['preco_desc', 'Maior preço'], ['solicitados', 'Mais solicitados'],
];
const KIND_LABEL = { SERVICO: 'Serviço', PRODUTO: 'Produto' };
const cache = new Map();

export default function Explore() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const [q, setQ] = useState(sp.get('q') || '');
  const [pendingQ, setPendingQ] = useState(sp.get('q') || '');
  const [category, setCategory] = useState('');
  const [kind, setKind] = useState(sp.get('kind') || '');
  const [country, setCountry] = useState('');
  const [certs, setCerts] = useState([]);
  const [sort, setSort] = useState('relevantes');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);

  const [data, setData] = useState(null);
  const [facets, setFacets] = useState({ categories: [], kinds: [], countries: [], certifications: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const firstLoad = useRef(true);

  useEffect(() => { setQ(sp.get('q') || ''); setPendingQ(sp.get('q') || ''); }, [sp]);

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
    try { await api.post('/api/marketplace/saved-searches', { label, query: qs }); setToast('Pesquisa guardada.'); }
    catch (e) { setToast(e.message); }
    setTimeout(() => setToast(''), 3500);
  }

  // Chips de filtros ativos.
  const chips = [];
  if (kind) chips.push({ k: 'kind', label: KIND_LABEL[kind] || kind, clear: () => setKind('') });
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
      <div className="svc-crumbs">Home <span>›</span> <strong>Explorar / Pesquisa</strong></div>
      <h1 className="svc-title">Explorar / Pesquisa</h1>

      <form className="exp-searchbar" onSubmit={doSearch}>
        <span className="svc-search-ico"><Icon name="search" size={18} /></span>
        <input value={pendingQ} onChange={(e) => setPendingQ(e.target.value)} placeholder="Pesquisar produtos, serviços ou fornecedores…" />
        <button className="btn btn-accent" type="submit">Pesquisar</button>
        <button type="button" className="btn btn-ghost exp-save" onClick={saveSearch}><Icon name="policy" size={14} /> Guardar Pesquisa</button>
      </form>

      <div className="svc-count">
        {loading ? 'A carregar…' : <>Resultado{q ? ` para "${q}"` : ''} <span className="exp-total">{total.toLocaleString('pt-PT')} resultados</span></>}
        <span className="svc-sortwrap">Ordenar por{' '}
          <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </span>
      </div>

      {chips.length > 0 && (
        <div className="chip-row">
          {chips.map((c) => (
            <button key={c.k} className="chip" onClick={() => { c.clear(); setPage(1); }}>{c.label} <span>×</span></button>
          ))}
          <button className="chip-clear" onClick={clearAll}>Limpar todos</button>
        </div>
      )}

      <div className="svc-layout">
        <aside className="svc-filters">
          <div className="flt-head"><strong>Filtrar Resultados</strong><button className="flt-clear" onClick={clearAll}>Limpar filtros</button></div>

          <div className="flt-group">
            <div className="flt-title">Categoria</div>
            {facets.categories.map((c) => (
              <label key={c.name} className="flt-check">
                <input type="checkbox" checked={category === c.name} onChange={() => { setCategory(category === c.name ? '' : c.name); setPage(1); }} />
                <span className="flt-lbl">{c.name}</span><span className="flt-num">({c.count})</span>
              </label>
            ))}
          </div>

          <div className="flt-group">
            <div className="flt-title">Tipo</div>
            {facets.kinds.map((t) => (
              <label key={t.name} className="flt-check">
                <input type="checkbox" checked={kind === t.name} onChange={() => { setKind(kind === t.name ? '' : t.name); setPage(1); }} />
                <span className="flt-lbl">{KIND_LABEL[t.name] || t.name}</span><span className="flt-num">({t.count})</span>
              </label>
            ))}
          </div>

          <div className="flt-group">
            <div className="flt-title">Localização</div>
            {facets.countries.map((c) => (
              <label key={c.name} className="flt-check">
                <input type="checkbox" checked={country === c.name} onChange={() => { setCountry(country === c.name ? '' : c.name); setPage(1); }} />
                <span className="flt-lbl">{c.name}</span><span className="flt-num">({c.count})</span>
              </label>
            ))}
            {facets.countries.length === 0 ? <p className="helptext" style={{ margin: 0 }}>—</p> : null}
          </div>

          <div className="flt-group">
            <div className="flt-title">Certificações</div>
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
            <div className="empty-state"><h3>Não foi possível carregar</h3><p>{error}</p><button className="btn btn-accent" onClick={load}>Tentar de novo</button></div>
          ) : loading ? (
            <div className="svc-grid">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="svc-card svc-skel" />)}</div>
          ) : total === 0 ? (
            <div className="empty-state"><h3>Nenhum resultado</h3><p>Ajuste a pesquisa ou os filtros.</p></div>
          ) : (
            <>
              <div className="svc-grid">
                {data.items.map((p) => <ExploreCard key={p.id} p={p} onFav={toggleFav} onOpen={() => navigate(`/comprador/servicos/${p.slug || p.id}`)} />)}
              </div>
              <div className="svc-pag">
                <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((x) => x - 1)}>← Anterior</button>
                {pageNumbers(page, pages).map((n, i) => n === '…'
                  ? <span key={`e${i}`} className="svc-ellipsis">…</span>
                  : <button key={n} className={`svc-pagn${n === page ? ' on' : ''}`} onClick={() => setPage(n)}>{n}</button>)}
                <button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => setPage((x) => x + 1)}>Próximo →</button>
                <span className="exp-perpage">Resultados por página{' '}
                  <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}>
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
  return (
    <div className="exp-card">
      <div className="exp-top">
        <span className="exp-logo">{p.supplier?.logoUrl ? <img src={p.supplier.logoUrl} alt={p.supplier.name} /> : initials(p.supplier?.name)}</span>
        <button className={`svc-fav${p.isFavorite ? ' on' : ''}`} onClick={() => onFav(p)} aria-label="Favorito">♥</button>
      </div>
      <strong className="svc-name" onClick={onOpen}>{p.name}</strong>
      <div className="svc-company">{p.supplier?.name}</div>
      <div className="svc-ratingrow">
        <Stars value={p.rating || 0} /> <span className="svc-ratenum">{p.rating ? p.rating.toFixed(1) : '—'} {p.reviewCount ? `(${p.reviewCount} avaliações)` : ''}</span>
        {p.supplier?.verified ? <span className="svc-verified">KIXIMA Verified</span> : null}
      </div>
      <p className="svc-desc">{p.description}</p>
      <div className="svc-metarow">
        <span><Icon name="offshore" size={13} /> {[p.city, p.country].filter(Boolean).join(', ') || '—'}</span>
        {p.leadTimeDays ? <span>Prazo {p.leadTimeDays} dias</span> : null}
      </div>
      <div className="exp-foot">
        <div><div className="exp-fromlbl">A partir de</div><div className="exp-price">{formatMoney(p.promoPrice || p.unitPrice, p.currency)}</div></div>
        <button className="btn btn-accent btn-sm" onClick={onOpen}>Ver Detalhes</button>
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
