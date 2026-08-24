// src/pages/corporate/CorporateHome.jsx
// Porta de app/page.tsx do repositório tocemedo-cpu/kiximaa (o código-fonte
// da página corporativa KIXIMA.NET) — mesma estrutura, mesmas classes CSS
// (ver corporate.css), mesmo texto por omissão (português). Mudanças em
// relação ao original:
//   1. Os links que no original apontavam para "https://kixima.net/..."
//      passam a rotas relativas via <Link> — já vivem no mesmo sítio.
//   2. "Registar como comprador/fornecedor" incluem ?tipo=CLIENTE|
//      FORNECEDOR, lidos por Register.jsx para pré-selecionar o tipo.
//   3. As imagens são import ES em vez de caminhos de public/ (Next.js).
//   4. Todo o texto passa pelo sistema de tradução do KIXIMA (useI18n/t) —
//      a chave é o próprio texto em português, exactamente como no resto
//      da app (ver src/i18n/index.jsx).
//   5. Uma nova secção ("stats-strip") com números REAIS da plataforma
//      (GET /api/public/stats), e o cartão "07 · Pagamento em 7 dias" da
//      secção "proof" passa a usar o prazo real configurado no backend
//      em vez de um texto fixo — pedido explícito do utilizador, para
//      "nada ser estático" nesta página. Isto diverge da fonte de verdade
//      visual (o repositório kiximaa não tem isto) de propósito.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n, LANGS } from '../../i18n';
import { api } from '../../api/client';
import './corporate.css';
import kiximaMark from './assets/kixima-mark.png';
import kiximaMarkReversed from './assets/kixima-mark-reversed.png';

function buildNavGroups(t) {
  return [
    { label: t('Sobre'), featured: t('Conheça a origem, a ambição e o impacto da KIXIMA.NET.'), links: [[t('Sobre a Kixima'), '#sobre'], [t('A nossa história'), '#historia'], [t('Impacto e conteúdo local'), '#impacto'], [t('Notícias e perspectivas'), '#noticias'], [t('Carreiras'), '#carreiras']] },
    { label: t('Soluções'), featured: t('Um ecossistema para quem compra, vende e desenvolve capacidade.'), links: [[t('Para compradores'), '#compradores'], [t('Para fornecedores'), '#fornecedores'], [t('Marketplace B2B'), '#marketplace'], ['Supplier Development', '/supplier-development'], [t('Parceiros internacionais'), '/parcerias'], [t('Planos e preços'), '/planos']] },
    { label: t('Como funciona'), featured: t('Da verificação ao pagamento, com visibilidade em cada etapa.'), links: [[t('Credenciamento'), '#como-funciona'], [t('Catálogo e classificação'), '#como-funciona'], [t('Pedidos e ordens de compra'), '#como-funciona'], [t('Entrega e recepção'), '#como-funciona'], [t('Pagamento em 7 dias'), '#pagamento']] },
    { label: t('Confiança'), featured: t('Due diligence uma vez. Confiança em cada transacção.'), links: [[t('Rede verificada'), '#confianca'], [t('Fornecedor verificado'), '#confianca'], [t('Segurança e privacidade'), '/privacidade'], [t('Termos de uso'), '/termos']] },
    { label: t('Recursos'), featured: t('Informação prática para começar e crescer na plataforma.'), links: [[t('Central de ajuda'), '#ajuda'], [t('Perguntas frequentes'), '#faq'], [t('Guias para fornecedores'), '#recursos'], [t('Contactos'), '#contactos']] },
  ];
}

// Um link do menu pode ser âncora da própria página (começa por "#") ou uma
// rota real da app — mantém o mesmo <a> para âncoras e usa <Link> só quando
// é navegação a sério, exactamente a distinção que já existia no original
// entre âncoras e o domínio kixima.net.
function NavLink({ href, className, children }) {
  if (href.startsWith('#')) return <a href={href} className={className}>{children}</a>;
  return <Link to={href} className={className}>{children}</Link>;
}

function Brand({ inverse = false, compact = false }) {
  const { t } = useI18n();
  // "#top" no original — a própria página é a home, por isso o logótipo só
  // faz scroll até ao topo, não navega (ver <main id="top"> mais abaixo).
  return <a className={`brand ${compact ? 'brand-compact' : ''}`} href="#top" aria-label={t('KIXIMA.NET - página inicial')}><img src={inverse ? kiximaMarkReversed : kiximaMark} alt="" /><span>KIXIMA<small>.NET</small></span></a>;
}

function Arrow() { return <span aria-hidden="true">↗</span>; }

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
function LanguagePicker() {
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

// Um dos 3 números da faixa de estatísticas — "—" enquanto não há dados
// reais ainda (nunca um número inventado a aparecer primeiro e ser
// substituído depois).
function Stat({ value, label }) {
  return <div className="stat"><strong>{value == null ? '—' : `${value}+`}</strong><span>{label}</span></div>;
}

export default function CorporateHome() {
  const { t } = useI18n();
  const [stats, setStats] = useState(null);

  // Scroll suave só enquanto esta página está montada — não altera o
  // comportamento de scroll do resto da app (ver corporate.css).
  useEffect(() => {
    document.documentElement.classList.add('kixima-corp-active');
    return () => document.documentElement.classList.remove('kixima-corp-active');
  }, []);

  // Números reais da plataforma (empresas, fornecedores, ordens, prazo de
  // pagamento) — nunca escritos à mão. Falha em silêncio: sem stats, a
  // faixa mostra "—" em vez de travar a página ou inventar um número.
  useEffect(() => {
    api.get('/api/public/stats').then(setStats).catch(() => {});
  }, []);

  const diasPagamento = stats?.pagamentoSlaDias ?? 7;

  return <main id="top" className="kixima-corp">
    <header className="site-header"><div className="header-inner"><Brand compact /><DesktopNavigation /><div className="header-actions"><Link className="login-link" to="/login">{t('Entrar')}</Link><Link className="button button-primary button-small" to="/cadastro">{t('Registar empresa')}</Link></div><MobileNavigation /></div></header>

    <section className="hero" aria-labelledby="hero-title"><div className="hero-pattern" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div><div className="hero-inner"><div className="hero-copy"><p className="kicker"><span></span> {t('Marketplace B2B nascido em Angola')}</p><h1 id="hero-title">{t('A fonte que liga')} <em>{t('negócios.')}</em></h1><p className="hero-lead">{t('Ligamos compradores a fornecedores qualificados num ecossistema seguro, transparente e auditável - preparado para o Oil & Gas e construído para crescer além dele.')}</p><div className="hero-actions"><Link className="button button-primary" to="/cadastro">{t('Registar a minha empresa')} <Arrow /></Link><a className="button button-secondary" href="#como-funciona">{t('Ver como funciona')}</a></div><div className="trust-line"><span><b>✓</b> {t('Empresas verificadas')}</span><span><b>✓</b> {t('Procurement garantido')}</span><span><b>✓</b> {t('Operação auditável')}</span></div></div>
      <div className="hero-visual" aria-label={t('Ecossistema KIXIMA.NET')}><div className="source-core"><img src={kiximaMark} alt={t('Símbolo KIXIMA.NET')} /><strong>{t('Uma fonte')}</strong><span>{t('Várias oportunidades')}</span></div><div className="orbit orbit-one"><b>{t('COMPRADORES')}</b><span>{t('Mais escolha')}</span></div><div className="orbit orbit-two"><b>{t('FORNECEDORES')}</b><span>{t('Mais mercado')}</span></div><div className="orbit orbit-three"><b>{t('CONFIANÇA')}</b><span>{t('Mais segurança')}</span></div><div className="connector connector-one"></div><div className="connector connector-two"></div><div className="connector connector-three"></div></div></div><div className="hero-bottom-pattern" aria-hidden="true"></div></section>

    <section className="stats-strip" aria-label={t('KIXIMA em números')}>
      <div className="stats-grid">
        <Stat value={stats?.empresasVerificadas} label={t('Empresas verificadas')} />
        <Stat value={stats?.fornecedoresQualificados} label={t('Fornecedores qualificados')} />
        <Stat value={stats?.ordensProcessadas} label={t('Ordens de compra concluídas')} />
      </div>
    </section>

    <section className="proof" aria-label={t('Proposta de valor')}><div className="proof-grid"><article><strong>01</strong><div><h2>{t('Due diligence uma vez')}</h2><p>{t('Credenciamento estruturado para gerar confiança em cada transacção.')}</p></div></article><article><strong>02</strong><div><h2>{t('Rede qualificada')}</h2><p>{t('Acesso a compradores, fornecedores e prestadores com capacidade verificada.')}</p></div></article><article id="pagamento"><strong>{String(diasPagamento).padStart(2, '0')}</strong><div><h2>{t('Pagamento em {dias} dias', { dias: diasPagamento })}</h2><p>{t('Mais previsibilidade financeira para fornecedores e melhor execução para compradores.')}</p></div></article><article><strong>360°</strong><div><h2>{t('Processo auditável')}</h2><p>{t('Catálogo, pedido, PO, entrega, recepção e pagamento numa só jornada.')}</p></div></article></div></section>

    <section className="section two-doors" id="marketplace"><div className="section-heading"><p className="eyebrow">{t('UM ECOSSISTEMA. DUAS PORTAS.')}</p><h2>{t('Entre para comprar.')}<br />{t('Entre para crescer.')}</h2><p>{t('A KIXIMA.NET reduz a distância entre quem precisa de comprar e quem está preparado para fornecer.')}</p></div><div className="door-grid">
      <article className="door buyer" id="compradores"><span className="door-number">01</span><div className="door-icon" aria-hidden="true">⌕</div><p className="eyebrow">{t('PARA COMPRADORES')}</p><h3>{t('Encontre capacidade. Compre com confiança.')}</h3><p>{t('Descubra novos fornecedores, compare ofertas e transforme necessidades em ordens de compra rastreáveis.')}</p><ul><li>{t('Catálogo classificado por UNSPSC')}</li><li>{t('Fornecedores credenciados')}</li><li>{t('Processo transparente e auditável')}</li></ul><Link to="/cadastro?tipo=CLIENTE">{t('Registar como comprador')} <Arrow /></Link></article>
      <article className="door supplier" id="fornecedores"><span className="door-number">02</span><div className="door-icon" aria-hidden="true">◇</div><p className="eyebrow">{t('PARA FORNECEDORES')}</p><h3>{t('Ganhe visibilidade. Aceda ao mercado.')}</h3><p>{t('Apresente o seu catálogo, responda a oportunidades e receba com maior previsibilidade.')}</p><ul><li>{t('Catálogo digital sem fronteiras')}</li><li>{t('Pedidos e POs organizados')}</li><li>{t('Programas de desenvolvimento')}</li></ul><Link to="/cadastro?tipo=FORNECEDOR">{t('Registar como fornecedor')} <Arrow /></Link></article>
    </div></section>

    <section className="section story" id="sobre"><div className="story-visual" aria-hidden="true"><div className="story-mark"><img src={kiximaMarkReversed} alt="" /></div><div className="story-quote">{t('“Por que razão uma pequena empresa do Cazenga não pode fornecer a uma grande operadora?”')}</div><div className="story-diamonds"><i></i><i></i><i></i><i></i></div></div><div className="story-copy" id="historia"><p className="eyebrow">{t('A NOSSA ORIGEM')}</p><h2>{t('Uma inquietação transformada em infraestrutura.')}</h2><p>{t('A KIXIMA nasceu de uma realidade observada durante mais de 20 anos de procurement: compradores concentrados nos mesmos fornecedores e empresas locais capazes sem acesso ao mercado.')}</p><p>{t('Construímos a ponte. Levamos fornecedores qualificados até aos compradores e damos às empresas locais a visibilidade, a capacitação e a confiança necessárias para competir.')}</p><a className="text-link" href="#impacto">{t('Conheça o nosso impacto')} <Arrow /></a></div></section>

    <section className="section process" id="como-funciona"><div className="section-heading centered"><p className="eyebrow">{t('COMO FUNCIONA')}</p><h2>{t('Da necessidade ao pagamento.')}</h2><p>{t('Uma jornada simples para processos complexos.')}</p></div><ol className="process-grid"><li><span>01</span><div className="process-diamond"></div><h3>{t('Credenciamento')}</h3><p>{t('A empresa submete os seus dados e documentos para verificação.')}</p></li><li><span>02</span><div className="process-diamond"></div><h3>{t('Mercado')}</h3><p>{t('Compradores pesquisam e fornecedores apresentam catálogos e propostas.')}</p></li><li><span>03</span><div className="process-diamond"></div><h3>{t('Execução')}</h3><p>{t('O pedido transforma-se em PO, entrega e confirmação de recepção.')}</p></li><li><span>04</span><div className="process-diamond"></div><h3>{t('Pagamento')}</h3><p>{t('A KIXIMA garante rastreabilidade e pagamento ao fornecedor em até 7 dias.')}</p></li></ol><div className="process-action"><Link className="button button-dark" to="/cadastro">{t('Começar agora')} <Arrow /></Link></div></section>

    <section className="programs" id="impacto"><div className="programs-inner"><div className="programs-heading"><p className="eyebrow">{t('MAIS DO QUE UM MARKETPLACE')}</p><h2>{t('Capacidade local. Parcerias globais.')}</h2></div><div className="program-cards"><article><span>SD</span><p className="eyebrow">{t('SUPPLIER DEVELOPMENT')}</p><h3>{t('Prepare a sua empresa para fornecer.')}</h3><p>{t('Apoio no processo de credenciamento, organização documental e desenvolvimento da capacidade empresarial.')}</p><Link to="/supplier-development">{t('Conhecer o programa')} <Arrow /></Link></article><article><span>↔</span><p className="eyebrow">{t('PARCEIROS INTERNACIONAIS')}</p><h3>{t('Ligue capacidade local a tecnologia global.')}</h3><p>{t('Facilitamos relações com parceiros estrangeiros para tecnologia, especialização, capacitação e crescimento conjunto.')}</p><Link to="/parcerias">{t('Encontrar parceiros')} <Arrow /></Link></article></div></div></section>

    <section className="section trust" id="confianca"><div className="trust-copy"><p className="eyebrow">{t('CONFIANÇA KIXIMA')}</p><h2>{t('Verificação que cria valor para os dois lados.')}</h2><p>{t('O nosso modelo foi concebido para reduzir risco, aumentar transparência e fortalecer a confiança entre empresas que ainda não fizeram negócios entre si.')}</p><Link className="text-link" to="/termos">{t('Conheça as regras da plataforma')} <Arrow /></Link></div><div className="trust-seal"><div className="seal-ring"><img src={kiximaMark} alt="" /><strong>{t('FORNECEDOR')}<br />{t('VERIFICADO')}</strong></div><div className="trust-list"><span><b>✓</b> {t('Documentação validada')}</span><span><b>✓</b> {t('Identidade empresarial confirmada')}</span><span><b>✓</b> {t('Histórico e processo auditáveis')}</span></div></div></section>

    <section className="final-cta"><div className="final-pattern" aria-hidden="true"></div><div><p className="eyebrow">{t('A SUA PRÓXIMA OPORTUNIDADE PODE COMEÇAR AQUI')}</p><h2>{t('Faça parte da fonte.')}</h2><p>{t('Registe a sua empresa e entre num novo ecossistema de procurement africano.')}</p></div><Link className="button button-light" to="/cadastro">{t('Registar empresa')} <Arrow /></Link></section>

    <footer className="site-footer" id="contactos"><div className="footer-top"><div className="footer-brand"><Brand inverse /><p>{t('Procurement garantido. Oportunidades ligadas. Capacidade africana visível.')}</p><LanguagePicker /></div><div className="footer-column"><h3>{t('Conheça a Kixima')}</h3><a href="#sobre">{t('Sobre nós')}</a><a href="#historia">{t('A nossa história')}</a><a href="#impacto">{t('Impacto e conteúdo local')}</a><a id="noticias" href="#noticias">{t('Notícias e perspectivas')}</a><a id="carreiras" href="#carreiras">{t('Carreiras')}</a></div><div className="footer-column"><h3>{t('Faça negócios connosco')}</h3><a href="#compradores">{t('Comprar na Kixima')}</a><a href="#fornecedores">{t('Vender na Kixima')}</a><Link to="/supplier-development">Supplier Development</Link><Link to="/parcerias">{t('Parceiros internacionais')}</Link><Link to="/planos">{t('Planos e preços')}</Link></div><div className="footer-column" id="ajuda"><h3>{t('Confiança e suporte')}</h3><a id="faq" href="#faq">{t('Perguntas frequentes')}</a><a id="recursos" href="#recursos">{t('Guias e recursos')}</a><a href="#confianca">{t('Fornecedor verificado')}</a><Link to="/login">{t('Aceder à minha conta')}</Link><a href="mailto:geral@kixima.net">{t('Contactar a Kixima')}</a></div></div><div className="footer-bottom"><span>{t('© 2026 KIXIMA.NET. Todos os direitos reservados.')}</span><div><Link to="/termos">{t('Termos de uso')}</Link><Link to="/privacidade">{t('Política de privacidade')}</Link></div><span>{t('Uma marca nascida em Angola.')}</span></div></footer>
  </main>;
}
