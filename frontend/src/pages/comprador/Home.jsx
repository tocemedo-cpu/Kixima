// src/pages/comprador/Home.jsx
// Home Marketplace do Comprador — 100% ligada ao banco (dashboard, categorias,
// trending, fornecedores verificados, atividades). Só o conteúdo; o sidebar e o
// header não são alterados.
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../api/client';
import { Loading, ErrorBanner } from '../../components/Common';
import { Icon, Stars, categoryVisual } from '../../components/icons';
import ProductCover from '../../components/ProductCover';
import { formatMoney } from '../../domain';
import { useI18n } from '../../i18n';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 19 ? 'Boa tarde' : 'Boa noite';
}
function timeAgo(iso, t) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return t('há {n} min', { n: Math.max(1, Math.floor(s / 60)) });
  if (s < 86400) return t('há {n}h', { n: Math.floor(s / 3600) });
  const d = Math.floor(s / 86400);
  return d > 1 ? t('há {n} dias', { n: d }) : t('há {n} dia', { n: d });
}
function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';
}

export default function Home() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/api/dashboard/comprador'),
      api.get('/api/marketplace/facets'),
      api.get('/api/marketplace/search', { sort: 'solicitados', limit: 4 }),
      api.get('/api/marketplace/search', { sort: 'vendidos', limit: 5 }),
      api.get('/api/marketplace/suppliers'),
      api.get('/api/notifications'),
    ]).then(([dash, facets, trending, frequent, suppliers, notifs]) => {
      setD({ dash, categories: facets.categories || [], trending: trending.items || [], frequent: frequent.items || [], suppliers: suppliers || [], notifs: (notifs?.itens || []).slice(0, 6) });
    }).catch((e) => setError(e.message));
  }, []);

  const firstName = useMemo(() => (user?.name || '').split(' ')[0], [user]);

  if (error) return <ErrorBanner message={error} />;
  if (!d) return <Loading />;

  const k = d.dash.kpis;
  const submitSearch = (e) => { e.preventDefault(); navigate(`/comprador/servicos${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`); };

  return (
    <div className="home">
      <div style={{ marginBottom: 20 }}>
        <h1 className="home-hi">{t(greeting())}, {firstName}! <span>👋</span></h1>
        <p className="home-sub">{t('O que pretende comprar hoje?')}</p>
        <form className="home-search" onSubmit={submitSearch}>
          <span className="home-search-ico"><Icon name="search" size={18} /></span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Pesquisar produtos, serviços ou fornecedores…')} />
          <button className="btn btn-accent" type="submit">{t('Pesquisar')}</button>
        </form>
      </div>

      <div className="home-kpis">
        <Kpi icon="invoice" label={t('Ordens de Compra')} value={k.emAndamento} sub={t('Em andamento')} tone="brand" to="/comprador/ordens" />
        <Kpi icon="payment" label={t('Aguardando Pagamento')} value={k.aguardandoPagamento.count} sub={`${t('Total')}: ${formatMoney(k.aguardandoPagamento.total)}`} tone="amber" to="/comprador/pagamentos" />
        <Kpi icon="truck" label={t('Em Entrega')} value={k.emEntrega.count} sub={`${t('Total')}: ${formatMoney(k.emEntrega.total)}`} tone="teal" to="/comprador/entregas" />
        <Kpi icon="reception" label={t('Recebidas')} value={k.recebidasMes} sub={t('Este mês')} tone="info" to="/comprador/recepcao" />
      </div>

      {/* Programas KIXIMA — abertos a qualquer empresa. */}
      <div className="home-programs">
        <a className="home-program" href="/supplier-development">
          <span className="home-program-ico"><Icon name="suppliers" size={18} /></span>
          <span>
            <strong>{t('Supplier Development')}</strong>
            <span>{t('Apoio burocrático e parceiros internacionais para empresas angolanas')}</span>
          </span>
        </a>
        <a className="home-program" href="/parcerias">
          <span className="home-program-ico"><Icon name="offshore" size={18} /></span>
          <span>
            <strong>{t('Parceiros internacionais')}</strong>
            <span>{t('Procura de parceiros estrangeiros para tecnologia e capacitação')}</span>
          </span>
        </a>
        <a className="home-program" href="/planos">
          <span className="home-program-ico"><Icon name="wallet" size={18} /></span>
          <span>
            <strong>{t('Planos e preços')}</strong>
            {/* Não se nomeiam os degraus aqui. A escada é BASE → CORE → PRO e
                vem de planService.tabela(); escrevê-la à mão num cartão de
                entrada garante que um dia diz outra coisa que a página de
                planos — e já dizia: tinha ficado nos dois planos antigos. */}
            <span>{t('Taxas por transação e acesso por utilizador, com os limites de cada plano')}</span>
          </span>
        </a>
      </div>

      <div className="home-row home-row-cats">
        <section className="card card-pad">
          <SectionHead title={t('Categorias Principais')} to="/comprador/catalogo" />
          <div className="cat-grid">
            {d.categories.slice(0, 8).map((c) => {
              const vis = categoryVisual(c.name);
              return (
                <Link key={c.name} to={`/comprador/servicos?category=${encodeURIComponent(c.name)}`} className="cat-tile">
                  <span className="cat-ico"><Icon name={vis.icon} size={24} /></span>
                  <span className="cat-name">{c.name}</span>
                </Link>
              );
            })}
            {d.categories.length === 0 ? <p className="helptext">{t('Sem categorias.')}</p> : null}
          </div>
        </section>

        <section className="protect-card">
          <span className="protect-shield"><Icon name="policy" size={40} /></span>
          <h3>{t('COMPRAS PROTEGIDAS KIXIMA')}</h3>
          <p>{t('Todas as transações são protegidas pela KIXIMA com fornecedores verificados e seguros de execução.')}</p>
          <Link to="/ajuda" className="protect-link">{t('Saiba mais')} →</Link>
        </section>
      </div>

      <div className="home-row home-row-trend">
        <section className="card card-pad">
          <SectionHead title={t('Trending na KIXIMA')} sub={t('Mais visualizados')} to="/comprador/servicos" />
          <div className="mini-grid">
            {d.trending.map((p) => <MiniCard key={p.id} p={p} onClick={() => navigate(`/comprador/servicos/${p.slug || p.id}`)} />)}
            {d.trending.length === 0 ? <p className="helptext">{t('Sem dados ainda.')}</p> : null}
          </div>
        </section>

        <section className="card card-pad">
          <SectionHead title={t('Minhas Ordens')} to="/comprador/ordens" />
          <ul className="ord-list">
            {d.dash.minhasOrdens.map((o) => (
              <li key={o.label}><span className="ord-dot" /><span>{t(o.label)}</span><strong>{o.count}</strong></li>
            ))}
          </ul>
        </section>

        <section className="card card-pad">
          <SectionHead title={t('Atividades Recentes')} to="/notificacoes" />
          {d.notifs.length === 0 ? <p className="helptext">{t('Sem atividades.')}</p> : (
            <ul className="act-list">
              {d.notifs.map((n) => (
                <li key={n.id}><span className="act-ico"><Icon name="activities" size={14} /></span>
                  <span className="act-txt">{n.title || n.message}</span>
                  <span className="act-time">{timeAgo(n.createdAt, t)}</span></li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="home-row home-row-bottom">
        <section className="card card-pad">
          <SectionHead title={t('Fornecedores Verificados')} to="/comprador/servicos?verified=true" />
          <div className="sup-grid">
            {d.suppliers.map((s) => (
              <div key={s.id} className="sup-card">
                <span className="sup-logo">{s.logoUrl ? <img src={s.logoUrl} alt={s.name} /> : initials(s.name)}</span>
                <span className="sup-name">{s.name}</span>
                {s.rating ? <span className="sup-rating">★ {s.rating.toFixed(1)}</span> : null}
              </div>
            ))}
            {d.suppliers.length === 0 ? <p className="helptext">{t('Sem fornecedores verificados.')}</p> : null}
          </div>
        </section>

        <section className="card card-pad">
          <SectionHead title={t('Compras Frequentes')} to="/comprador/catalogo" />
          <div className="mini-grid mini-grid-5">
            {d.frequent.map((p) => <MiniCard key={p.id} p={p} fromPrice onClick={() => navigate(`/comprador/servicos/${p.slug || p.id}`)} />)}
            {d.frequent.length === 0 ? <p className="helptext">{t('Sem dados ainda.')}</p> : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionHead({ title, sub, to }) {
  const { t } = useI18n();
  return (
    <div className="sec-head">
      <div><strong>{title}</strong>{sub ? <span className="sec-sub"> · {sub}</span> : null}</div>
      {to ? <Link to={to} className="sec-link">{t('Ver todas')}</Link> : null}
    </div>
  );
}

// `to` opcional. Sem ele sai o mesmo <div> de sempre — este componente é local
// a esta página de propósito (tem `tone` e disposição próprias), e unificá-lo
// com o KpiRow seria refazer o visual da home do comprador sem necessidade.
function Kpi({ icon, label, value, sub, tone, to }) {
  const corpo = (
    <>
      <div className="kpi-body"><div className="kpi-label">{label}</div><div className="kpi-value">{value}</div><div className="kpi-sub">{sub}</div></div>
      <span className="kpi-ico"><Icon name={icon} size={20} /></span>
    </>
  );
  if (!to) return <div className={`kpi kpi-${tone}`}>{corpo}</div>;
  return <Link className={`kpi kpi-${tone} kpi-link`} to={to}>{corpo}</Link>;
}

function MiniCard({ p, fromPrice, onClick }) {
  const { t } = useI18n();
  return (
    <div className="mini-card" onClick={onClick}>
      <div className="mini-img"><ProductCover imageUrl={p.imageUrl} category={p.category} name={p.name} caption={false} /></div>
      <div className="mini-name">{p.name}</div>
      <div className="mini-company">{p.supplier?.name}</div>
      <div className="mini-price">{fromPrice ? <span className="mini-from">{t('A partir de')} </span> : null}{formatMoney(p.promoPrice || p.unitPrice, p.currency)}</div>
      {!fromPrice && p.rating ? <div className="mini-rating"><Stars value={p.rating} /> <span>{p.rating.toFixed(1)} {p.reviewCount ? `(${p.reviewCount})` : ''}</span></div> : null}
    </div>
  );
}
