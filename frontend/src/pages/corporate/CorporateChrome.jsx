// src/pages/corporate/CorporateChrome.jsx
// Cabeçalho, rodapé e navegação partilhados por TODAS as páginas do site
// corporativo (home + Notícias/Carreiras/FAQ/Recursos) — extraídos de
// CorporateHome.jsx para que as novas páginas tenham a mesma navegação,
// sem duplicar código.
//
// Todos os links de secção (começam por "#") passam por <Link to={`/${href}`}>
// em vez de <a href="#...">: as secções com esses ids só existem na home,
// por isso qualquer link de secção clicado a partir de outra página tem de
// navegar para "/" primeiro. O scroll até à secção é feito pelo hook
// useScrollToHash(), usado em CorporateHome.
//
// O design de origem (pacote "SELECTED_EXACT") não tem mega-menu — é uma
// lista plana de âncoras, porque a página dele só tem a home. Este site
// corporativo tem mais páginas reais (Notícias, Carreiras, FAQ, Recursos,
// Supplier Development, Parceiros, Planos, Termos, Privacidade), por isso o
// mega-menu com sub-grupos foi mantido (já existia nas versões anteriores
// desta página) — só a aparência foi actualizada para a nova identidade
// (barra superior, cabeçalho maior, tipografia mais densa).
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n, LANGS } from '../../i18n';
import kiximaMark from '../../assets/brand/kixima-mark.png';
import kiximaMarkReversed from '../../assets/brand/kixima-mark-reversed.png';

// Scroll suave enquanto qualquer página do site corporativo está montada —
// não altera o comportamento de scroll do resto da app (ver corporate.css).
export function useCorporateActive() {
  useEffect(() => {
    document.documentElement.classList.add('kixima-corp-active');
    return () => document.documentElement.classList.remove('kixima-corp-active');
  }, []);
}

export function buildNavGroups(t) {
  return [
    { label: t('Sobre'), featured: t('Conheça a origem, a ambição e o impacto da KIXIMA.NET.'), links: [[t('Sobre a Kixima'), '#sobre'], ['Roadmap', '#roadmap'], [t('Notícias e perspectivas'), '/noticias'], [t('Carreiras'), '/carreiras']] },
    { label: t('Plataforma'), featured: t('Um ecossistema para quem compra, vende e desenvolve capacidade.'), links: [[t('Visão geral da plataforma'), '#plataforma'], [t('Para compradores'), '#compradores'], [t('Para fornecedores'), '#fornecedores'], [t('Sectores que servimos'), '#sectores'], [t('Demonstração da plataforma'), '#demonstracao'], ['Supplier Development', '/supplier-development'], [t('Parceiros internacionais'), '/parcerias'], [t('Planos e preços'), '/planos']] },
    { label: t('Como funciona'), featured: t('Da verificação ao pagamento, com visibilidade em cada etapa.'), links: [[t('Credenciamento'), '#como-funciona'], [t('Mercado'), '#como-funciona'], [t('Execução'), '#como-funciona'], [t('Pagamento em 7 dias'), '#pagamento']] },
    { label: t('Confiança'), featured: t('Due diligence uma vez. Confiança em cada transacção.'), links: [[t('Diferenciais'), '#diferenciais'], [t('Avaliações'), '#avaliacoes'], [t('Segurança e privacidade'), '/privacidade'], [t('Termos de uso'), '/termos']] },
    { label: t('Recursos'), featured: t('Informação prática para começar e crescer na plataforma.'), links: [[t('Central de ajuda'), '#contactos'], [t('Perguntas frequentes'), '/faq'], [t('Guias para fornecedores'), '/recursos'], [t('Contactos'), '#contactos']] },
  ];
}

// Um link do menu pode ser âncora de secção da home (começa por "#") ou uma
// rota real da app. Âncoras passam sempre por "/#secção": as secções só
// existem na home, e useScrollToHash() trata do scroll assim que lá chega.
export function NavLink({ href, className, children }) {
  const to = href.startsWith('#') ? `/${href}` : href;
  return <Link to={to} className={className}>{children}</Link>;
}

export function Brand({ inverse = false, compact = false, isHome = false }) {
  const { t } = useI18n();
  const content = <><img src={inverse ? kiximaMarkReversed : kiximaMark} alt="" /><span>KIXIMA<small>.NET</small></span></>;
  const className = `brand ${compact ? 'brand-compact' : ''}`;
  const label = t('KIXIMA.NET — página inicial');
  // "#top" só na home, onde <main id="top"> existe — o logótipo faz scroll
  // até ao topo em vez de navegar. Nas restantes páginas, navega para "/".
  if (isHome) return <a className={className} href="#top" aria-label={label}>{content}</a>;
  return <Link className={className} to="/" aria-label={label}>{content}</Link>;
}

export function Arrow() { return <span aria-hidden="true">↗</span>; }

function ChevronIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 8 5 5 5-5" /></svg>;
}

// Barra superior fixa no topo da página (não fixa ao scroll — só o
// <header> abaixo é sticky) — parte da nova identidade visual, sem
// equivalente nas versões anteriores desta página.
export function TopStrip() {
  const { t } = useI18n();
  return <div className="top-strip"><span>{t('E-MARKETPLACE B2B · SOURCE-TO-PAY')}</span><b>{t('NASCIDO EM ANGOLA · PREPARADO PARA ÁFRICA')}</b></div>;
}

// Dropdown de idiomas real — mesma lógica (useI18n/LANGS/setLang) que já
// existia no pill do rodapé, agora com as três opções visíveis de uma vez em
// vez de ciclar num clique só. Usado no cabeçalho (pedido do utilizador) e
// no rodapé, que ganha a mesma interação em vez de duas formas diferentes de
// mudar de idioma no mesmo site.
export function LanguageDropdown() {
  const { t, lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClickOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0];

  return (
    <div className={`lang-switch${open ? ' open' : ''}`} ref={ref}>
      <button
        type="button"
        className="lang-switch-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('Idioma')}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{current.flag}</span> {current.label} <ChevronIcon />
      </button>
      {open && (
        <div className="lang-switch-menu" role="listbox" aria-label={t('Idioma')}>
          {LANGS.map((l) => (
            <button
              key={l.code}
              type="button"
              role="option"
              aria-selected={l.code === lang}
              className={`lang-switch-item${l.code === lang ? ' on' : ''}`}
              onClick={() => { setLang(l.code); setOpen(false); }}
            >
              <span>{l.flag}</span> {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DesktopNavigation() {
  const { t } = useI18n();
  const navGroups = buildNavGroups(t);
  return <nav className="desktop-nav" aria-label={t('Navegação principal')}>{navGroups.map((group) => <div className="nav-item" key={group.label}><button type="button" aria-haspopup="true">{group.label}<span aria-hidden="true">⌄</span></button><div className="mega-menu"><div className="mega-intro"><span className="eyebrow">{group.label}</span><p>{group.featured}</p></div><div className="mega-links">{group.links.map(([label, href]) => <NavLink href={href} key={label}>{label}<Arrow /></NavLink>)}</div></div></div>)}</nav>;
}

function MobileNavigation() {
  const { t } = useI18n();
  const navGroups = buildNavGroups(t);
  return <details className="mobile-nav"><summary aria-label={t('Abrir menu')}><span></span><span></span><span></span></summary><div className="mobile-panel">{navGroups.map((group) => <details key={group.label}><summary>{group.label}<span>+</span></summary><div>{group.links.map(([label, href]) => <NavLink href={href} key={label}>{label}</NavLink>)}</div></details>)}<LanguageDropdown /><Link className="mobile-login" to="/login">{t('Entrar')}</Link><Link className="button button-primary" to="/cadastro">{t('Registar empresa')}</Link></div></details>;
}

export function CorporateHeader({ isHome = false }) {
  const { t } = useI18n();
  return <><TopStrip /><header className="site-header"><Brand compact isHome={isHome} /><DesktopNavigation /><Link className="login-link" to="/login">{t('Entrar')}</Link><Link className="button button-primary" to="/cadastro">{t('Registar empresa')}</Link><div className="header-actions"><LanguageDropdown /></div><MobileNavigation /></header></>;
}

export function CorporateFooter({ isHome = false }) {
  const { t } = useI18n();
  return <footer className="site-footer" id="contactos"><div className="footer-main">
    <div className="footer-brand"><Brand inverse isHome={isHome} /><p>{t('The state of the art — do procurement à execução.')}</p><LanguageDropdown /></div>
    <div className="footer-column"><h3>{t('Plataforma')}</h3><NavLink href="#plataforma">{t('Visão geral')}</NavLink><NavLink href="#demonstracao">{t('Demonstração')}</NavLink><NavLink href="#empresas">{t('Para empresas')}</NavLink><NavLink href="#como-funciona">{t('Como funciona')}</NavLink><Link to="/planos">{t('Planos e preços')}</Link></div>
    <div className="footer-column"><h3>{t('Empresa')}</h3><NavLink href="#sobre">{t('Sobre a Kixima')}</NavLink><NavLink href="#roadmap">Roadmap</NavLink><Link to="/noticias">{t('Notícias e perspectivas')}</Link><Link to="/carreiras">{t('Carreiras')}</Link><a href="mailto:geral@kixima.net">{t('Contactos')}</a><Link to="/login">{t('Entrar')}</Link></div>
    <div className="footer-column"><h3>{t('Confiança')}</h3><NavLink href="#diferenciais">{t('Diferenciais')}</NavLink><NavLink href="#avaliacoes">{t('Avaliações verificadas')}</NavLink><Link to="/faq">{t('Perguntas frequentes')}</Link><Link to="/recursos">{t('Guias e recursos')}</Link><Link to="/supplier-development">Supplier Development</Link><Link to="/parcerias">{t('Parceiros internacionais')}</Link><Link to="/termos">{t('Termos de uso')}</Link><Link to="/privacidade">{t('Privacidade')}</Link></div>
  </div><div className="footer-bottom"><span>{t('© 2026 KIXIMA.NET. Todos os direitos reservados.')}</span><b>{t('NASCIDO EM ANGOLA · PREPARADO PARA ÁFRICA')}</b></div></footer>;
}
