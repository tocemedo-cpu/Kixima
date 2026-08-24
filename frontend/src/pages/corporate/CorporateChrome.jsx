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
import { useEffect } from 'react';
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
    { label: t('Sobre'), featured: t('Conheça a origem, a ambição e o impacto da KIXIMA.NET.'), links: [[t('Sobre a Kixima'), '#sobre'], [t('A nossa história'), '#historia'], [t('Impacto e conteúdo local'), '#impacto'], [t('Notícias e perspectivas'), '/noticias'], [t('Carreiras'), '/carreiras']] },
    { label: t('Soluções'), featured: t('Um ecossistema para quem compra, vende e desenvolve capacidade.'), links: [[t('Para compradores'), '#compradores'], [t('Para fornecedores'), '#fornecedores'], [t('Marketplace B2B'), '#marketplace'], ['Supplier Development', '/supplier-development'], [t('Parceiros internacionais'), '/parcerias'], [t('Planos e preços'), '/planos']] },
    { label: t('Como funciona'), featured: t('Da verificação ao pagamento, com visibilidade em cada etapa.'), links: [[t('Credenciamento'), '#como-funciona'], [t('Catálogo e classificação'), '#como-funciona'], [t('Pedidos e ordens de compra'), '#como-funciona'], [t('Entrega e recepção'), '#como-funciona'], [t('Pagamento em 7 dias'), '#pagamento']] },
    { label: t('Confiança'), featured: t('Due diligence uma vez. Confiança em cada transacção.'), links: [[t('Rede verificada'), '#confianca'], [t('Fornecedor verificado'), '#confianca'], [t('Segurança e privacidade'), '/privacidade'], [t('Termos de uso'), '/termos']] },
    { label: t('Recursos'), featured: t('Informação prática para começar e crescer na plataforma.'), links: [[t('Central de ajuda'), '#ajuda'], [t('Perguntas frequentes'), '/faq'], [t('Guias para fornecedores'), '/recursos'], [t('Contactos'), '#contactos']] },
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
  const label = t('KIXIMA.NET - página inicial');
  // "#top" só na home, onde <main id="top"> existe — o logótipo faz scroll
  // até ao topo em vez de navegar. Nas restantes páginas, navega para "/".
  if (isHome) return <a className={className} href="#top" aria-label={label}>{content}</a>;
  return <Link className={className} to="/" aria-label={label}>{content}</Link>;
}

export function Arrow() { return <span aria-hidden="true">↗</span>; }

function DesktopNavigation() {
  const { t } = useI18n();
  const navGroups = buildNavGroups(t);
  return <nav className="desktop-nav" aria-label={t('Navegação principal')}>{navGroups.map((group) => <div className="nav-item" key={group.label}><button type="button" aria-haspopup="true">{group.label}<span aria-hidden="true">⌄</span></button><div className="mega-menu"><div className="mega-intro"><span className="eyebrow">{group.label}</span><p>{group.featured}</p></div><div className="mega-links">{group.links.map(([label, href]) => <NavLink href={href} key={label}>{label}<Arrow /></NavLink>)}</div></div></div>)}</nav>;
}

function MobileNavigation() {
  const { t } = useI18n();
  const navGroups = buildNavGroups(t);
  return <details className="mobile-nav"><summary aria-label={t('Abrir menu')}><span></span><span></span><span></span></summary><div className="mobile-panel">{navGroups.map((group) => <details key={group.label}><summary>{group.label}<span>+</span></summary><div>{group.links.map(([label, href]) => <NavLink href={href} key={label}>{label}</NavLink>)}</div></details>)}<Link className="mobile-login" to="/login">{t('Entrar')}</Link><Link className="button button-primary" to="/cadastro">{t('Registar empresa')}</Link></div></details>;
}

// O pill de idioma do rodapé, no original só mostra "🇦🇴 Português ⌄" sem
// fazer nada — aqui ganha a única coisa que lhe falta para ser real: clicar
// avança para o próximo idioma (PT → EN → FR → PT), sem nenhum elemento
// novo no ecrã. Div (não button) para não herdar o reset de <button> do
// browser e manter o visual bit a bit igual ao original.
export function LanguagePicker() {
  const { t, lang, setLang } = useI18n();
  const idx = LANGS.findIndex((l) => l.code === lang);
  const current = LANGS[idx] ?? LANGS[0];
  const next = LANGS[(idx + 1) % LANGS.length];
  const activar = () => setLang(next.code);
  return (
    <div
      className="language"
      role="button"
      tabIndex={0}
      aria-label={t('Idioma')}
      onClick={activar}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activar(); } }}
    >
      <span>{current.flag}</span> {current.label} <b>⌄</b>
    </div>
  );
}

export function CorporateHeader({ isHome = false }) {
  const { t } = useI18n();
  return <header className="site-header"><div className="header-inner"><Brand compact isHome={isHome} /><DesktopNavigation /><div className="header-actions"><Link className="login-link" to="/login">{t('Entrar')}</Link><Link className="button button-primary button-small" to="/cadastro">{t('Registar empresa')}</Link></div><MobileNavigation /></div></header>;
}

export function CorporateFooter({ isHome = false }) {
  const { t } = useI18n();
  return <footer className="site-footer" id="contactos"><div className="footer-top"><div className="footer-brand"><Brand inverse isHome={isHome} /><p>{t('Procurement garantido. Oportunidades ligadas. Capacidade africana visível.')}</p><LanguagePicker /></div><div className="footer-column"><h3>{t('Conheça a Kixima')}</h3><NavLink href="#sobre">{t('Sobre nós')}</NavLink><NavLink href="#historia">{t('A nossa história')}</NavLink><NavLink href="#impacto">{t('Impacto e conteúdo local')}</NavLink><Link to="/noticias">{t('Notícias e perspectivas')}</Link><Link to="/carreiras">{t('Carreiras')}</Link></div><div className="footer-column"><h3>{t('Faça negócios connosco')}</h3><NavLink href="#compradores">{t('Comprar na Kixima')}</NavLink><NavLink href="#fornecedores">{t('Vender na Kixima')}</NavLink><Link to="/supplier-development">Supplier Development</Link><Link to="/parcerias">{t('Parceiros internacionais')}</Link><Link to="/planos">{t('Planos e preços')}</Link></div><div className="footer-column" id="ajuda"><h3>{t('Confiança e suporte')}</h3><Link to="/faq">{t('Perguntas frequentes')}</Link><Link to="/recursos">{t('Guias e recursos')}</Link><NavLink href="#confianca">{t('Fornecedor verificado')}</NavLink><Link to="/login">{t('Aceder à minha conta')}</Link><a href="mailto:geral@kixima.net">{t('Contactar a Kixima')}</a></div></div><div className="footer-bottom"><span>{t('© 2026 KIXIMA.NET. Todos os direitos reservados.')}</span><div><Link to="/termos">{t('Termos de uso')}</Link><Link to="/privacidade">{t('Política de privacidade')}</Link></div><span>{t('Uma marca nascida em Angola.')}</span></div></footer>;
}
