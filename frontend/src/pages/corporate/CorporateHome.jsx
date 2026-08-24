// src/pages/corporate/CorporateHome.jsx
// Porta fiel de app/page.tsx do repositório tocemedo-cpu/kiximaa (o
// código-fonte da página corporativa KIXIMA.NET) — mesma estrutura, mesmo
// texto, mesmas classes CSS (ver corporate.css). As únicas mudanças em
// relação ao original:
//   1. Os links que no original apontavam para "https://kixima.net/..."
//      (porque a página corporativa foi pensada para viver num domínio
//      separado) passam a ser rotas relativas da própria app — usando
//      <Link> do react-router para navegação sem recarregar a página — já
//      que agora vivem os dois no mesmo sítio.
//   2. "Registar como comprador" / "Registar como fornecedor" (a única
//      diferenciação de fluxo que faz sentido aqui) passam a incluir
//      ?tipo=CLIENTE / ?tipo=FORNECEDOR, lido por Register.jsx para
//      pré-selecionar o tipo — o formulário de cadastro em si não muda.
//   3. As imagens deixam de ser caminhos absolutos de public/ (Next.js) e
//      passam a import ES (Vite resolve e serve o mesmo ficheiro).
// Tudo o resto — texto, ordem das secções, nomes de classes, estrutura HTML
// — é exactamente o do ficheiro de origem.
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import './corporate.css';
import kiximaMark from './assets/kixima-mark.png';
import kiximaMarkReversed from './assets/kixima-mark-reversed.png';

const navGroups = [
  { label: 'Sobre', featured: 'Conheça a origem, a ambição e o impacto da KIXIMA.NET.', links: [['Sobre a Kixima', '#sobre'], ['A nossa história', '#historia'], ['Impacto e conteúdo local', '#impacto'], ['Notícias e perspectivas', '#noticias'], ['Carreiras', '#carreiras']] },
  { label: 'Soluções', featured: 'Um ecossistema para quem compra, vende e desenvolve capacidade.', links: [['Para compradores', '#compradores'], ['Para fornecedores', '#fornecedores'], ['Marketplace B2B', '#marketplace'], ['Supplier Development', '/supplier-development'], ['Parceiros internacionais', '/parcerias'], ['Planos e preços', '/planos']] },
  { label: 'Como funciona', featured: 'Da verificação ao pagamento, com visibilidade em cada etapa.', links: [['Credenciamento', '#como-funciona'], ['Catálogo e classificação', '#como-funciona'], ['Pedidos e ordens de compra', '#como-funciona'], ['Entrega e recepção', '#como-funciona'], ['Pagamento em 7 dias', '#pagamento']] },
  { label: 'Confiança', featured: 'Due diligence uma vez. Confiança em cada transacção.', links: [['Rede verificada', '#confianca'], ['Fornecedor verificado', '#confianca'], ['Segurança e privacidade', '/privacidade'], ['Termos de uso', '/termos']] },
  { label: 'Recursos', featured: 'Informação prática para começar e crescer na plataforma.', links: [['Central de ajuda', '#ajuda'], ['Perguntas frequentes', '#faq'], ['Guias para fornecedores', '#recursos'], ['Contactos', '#contactos']] },
];

// Um link do menu pode ser âncora da própria página (começa por "#") ou uma
// rota real da app — mantém o mesmo <a> para âncoras e usa <Link> só quando
// é navegação a sério, exactamente a distinção que já existia no original
// entre âncoras e o domínio kixima.net.
function NavLink({ href, className, children }) {
  if (href.startsWith('#')) return <a href={href} className={className}>{children}</a>;
  return <Link to={href} className={className}>{children}</Link>;
}

function Brand({ inverse = false, compact = false }) {
  // "#top" no original — a própria página é a home, por isso o logótipo só
  // faz scroll até ao topo, não navega (ver <main id="top"> mais abaixo).
  return <a className={`brand ${compact ? 'brand-compact' : ''}`} href="#top" aria-label="KIXIMA.NET - página inicial"><img src={inverse ? kiximaMarkReversed : kiximaMark} alt="" /><span>KIXIMA<small>.NET</small></span></a>;
}

function Arrow() { return <span aria-hidden="true">↗</span>; }

function DesktopNavigation() {
  return <nav className="desktop-nav" aria-label="Navegação principal">{navGroups.map((group) => <div className="nav-item" key={group.label}><button type="button" aria-haspopup="true">{group.label}<span aria-hidden="true">⌄</span></button><div className="mega-menu"><div className="mega-intro"><span className="eyebrow">{group.label}</span><p>{group.featured}</p></div><div className="mega-links">{group.links.map(([label, href]) => <NavLink href={href} key={label}>{label}<Arrow /></NavLink>)}</div></div></div>)}</nav>;
}

function MobileNavigation() {
  return <details className="mobile-nav"><summary aria-label="Abrir menu"><span></span><span></span><span></span></summary><div className="mobile-panel">{navGroups.map((group) => <details key={group.label}><summary>{group.label}<span>+</span></summary><div>{group.links.map(([label, href]) => <NavLink href={href} key={label}>{label}</NavLink>)}</div></details>)}<Link className="mobile-login" to="/login">Entrar</Link><Link className="button button-primary" to="/cadastro">Registar empresa</Link></div></details>;
}

export default function CorporateHome() {
  // Scroll suave só enquanto esta página está montada — não altera o
  // comportamento de scroll do resto da app (ver corporate.css).
  useEffect(() => {
    document.documentElement.classList.add('kixima-corp-active');
    return () => document.documentElement.classList.remove('kixima-corp-active');
  }, []);

  return <main id="top" className="kixima-corp">
    <header className="site-header"><div className="header-inner"><Brand compact /><DesktopNavigation /><div className="header-actions"><Link className="login-link" to="/login">Entrar</Link><Link className="button button-primary button-small" to="/cadastro">Registar empresa</Link></div><MobileNavigation /></div></header>

    <section className="hero" aria-labelledby="hero-title"><div className="hero-pattern" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div><div className="hero-inner"><div className="hero-copy"><p className="kicker"><span></span> Marketplace B2B nascido em Angola</p><h1 id="hero-title">A fonte que liga <em>negócios.</em></h1><p className="hero-lead">Ligamos compradores a fornecedores qualificados num ecossistema seguro, transparente e auditável - preparado para o Oil &amp; Gas e construído para crescer além dele.</p><div className="hero-actions"><Link className="button button-primary" to="/cadastro">Registar a minha empresa <Arrow /></Link><a className="button button-secondary" href="#como-funciona">Ver como funciona</a></div><div className="trust-line"><span><b>✓</b> Empresas verificadas</span><span><b>✓</b> Procurement garantido</span><span><b>✓</b> Operação auditável</span></div></div>
      <div className="hero-visual" aria-label="Ecossistema KIXIMA.NET"><div className="source-core"><img src={kiximaMark} alt="Símbolo KIXIMA.NET" /><strong>Uma fonte</strong><span>Várias oportunidades</span></div><div className="orbit orbit-one"><b>COMPRADORES</b><span>Mais escolha</span></div><div className="orbit orbit-two"><b>FORNECEDORES</b><span>Mais mercado</span></div><div className="orbit orbit-three"><b>CONFIANÇA</b><span>Mais segurança</span></div><div className="connector connector-one"></div><div className="connector connector-two"></div><div className="connector connector-three"></div></div></div><div className="hero-bottom-pattern" aria-hidden="true"></div></section>

    <section className="proof" aria-label="Proposta de valor"><div className="proof-grid"><article><strong>01</strong><div><h2>Due diligence uma vez</h2><p>Credenciamento estruturado para gerar confiança em cada transacção.</p></div></article><article><strong>02</strong><div><h2>Rede qualificada</h2><p>Acesso a compradores, fornecedores e prestadores com capacidade verificada.</p></div></article><article id="pagamento"><strong>07</strong><div><h2>Pagamento em 7 dias</h2><p>Mais previsibilidade financeira para fornecedores e melhor execução para compradores.</p></div></article><article><strong>360°</strong><div><h2>Processo auditável</h2><p>Catálogo, pedido, PO, entrega, recepção e pagamento numa só jornada.</p></div></article></div></section>

    <section className="section two-doors" id="marketplace"><div className="section-heading"><p className="eyebrow">UM ECOSSISTEMA. DUAS PORTAS.</p><h2>Entre para comprar.<br />Entre para crescer.</h2><p>A KIXIMA.NET reduz a distância entre quem precisa de comprar e quem está preparado para fornecer.</p></div><div className="door-grid">
      <article className="door buyer" id="compradores"><span className="door-number">01</span><div className="door-icon" aria-hidden="true">⌕</div><p className="eyebrow">PARA COMPRADORES</p><h3>Encontre capacidade. Compre com confiança.</h3><p>Descubra novos fornecedores, compare ofertas e transforme necessidades em ordens de compra rastreáveis.</p><ul><li>Catálogo classificado por UNSPSC</li><li>Fornecedores credenciados</li><li>Processo transparente e auditável</li></ul><Link to="/cadastro?tipo=CLIENTE">Registar como comprador <Arrow /></Link></article>
      <article className="door supplier" id="fornecedores"><span className="door-number">02</span><div className="door-icon" aria-hidden="true">◇</div><p className="eyebrow">PARA FORNECEDORES</p><h3>Ganhe visibilidade. Aceda ao mercado.</h3><p>Apresente o seu catálogo, responda a oportunidades e receba com maior previsibilidade.</p><ul><li>Catálogo digital sem fronteiras</li><li>Pedidos e POs organizados</li><li>Programas de desenvolvimento</li></ul><Link to="/cadastro?tipo=FORNECEDOR">Registar como fornecedor <Arrow /></Link></article>
    </div></section>

    <section className="section story" id="sobre"><div className="story-visual" aria-hidden="true"><div className="story-mark"><img src={kiximaMarkReversed} alt="" /></div><div className="story-quote">“Por que razão uma pequena empresa do Cazenga não pode fornecer a uma grande operadora?”</div><div className="story-diamonds"><i></i><i></i><i></i><i></i></div></div><div className="story-copy" id="historia"><p className="eyebrow">A NOSSA ORIGEM</p><h2>Uma inquietação transformada em infraestrutura.</h2><p>A KIXIMA nasceu de uma realidade observada durante mais de 20 anos de procurement: compradores concentrados nos mesmos fornecedores e empresas locais capazes sem acesso ao mercado.</p><p>Construímos a ponte. Levamos fornecedores qualificados até aos compradores e damos às empresas locais a visibilidade, a capacitação e a confiança necessárias para competir.</p><a className="text-link" href="#impacto">Conheça o nosso impacto <Arrow /></a></div></section>

    <section className="section process" id="como-funciona"><div className="section-heading centered"><p className="eyebrow">COMO FUNCIONA</p><h2>Da necessidade ao pagamento.</h2><p>Uma jornada simples para processos complexos.</p></div><ol className="process-grid"><li><span>01</span><div className="process-diamond"></div><h3>Credenciamento</h3><p>A empresa submete os seus dados e documentos para verificação.</p></li><li><span>02</span><div className="process-diamond"></div><h3>Mercado</h3><p>Compradores pesquisam e fornecedores apresentam catálogos e propostas.</p></li><li><span>03</span><div className="process-diamond"></div><h3>Execução</h3><p>O pedido transforma-se em PO, entrega e confirmação de recepção.</p></li><li><span>04</span><div className="process-diamond"></div><h3>Pagamento</h3><p>A KIXIMA garante rastreabilidade e pagamento ao fornecedor em até 7 dias.</p></li></ol><div className="process-action"><Link className="button button-dark" to="/cadastro">Começar agora <Arrow /></Link></div></section>

    <section className="programs" id="impacto"><div className="programs-inner"><div className="programs-heading"><p className="eyebrow">MAIS DO QUE UM MARKETPLACE</p><h2>Capacidade local. Parcerias globais.</h2></div><div className="program-cards"><article><span>SD</span><p className="eyebrow">SUPPLIER DEVELOPMENT</p><h3>Prepare a sua empresa para fornecer.</h3><p>Apoio no processo de credenciamento, organização documental e desenvolvimento da capacidade empresarial.</p><Link to="/supplier-development">Conhecer o programa <Arrow /></Link></article><article><span>↔</span><p className="eyebrow">PARCEIROS INTERNACIONAIS</p><h3>Ligue capacidade local a tecnologia global.</h3><p>Facilitamos relações com parceiros estrangeiros para tecnologia, especialização, capacitação e crescimento conjunto.</p><Link to="/parcerias">Encontrar parceiros <Arrow /></Link></article></div></div></section>

    <section className="section trust" id="confianca"><div className="trust-copy"><p className="eyebrow">CONFIANÇA KIXIMA</p><h2>Verificação que cria valor para os dois lados.</h2><p>O nosso modelo foi concebido para reduzir risco, aumentar transparência e fortalecer a confiança entre empresas que ainda não fizeram negócios entre si.</p><Link className="text-link" to="/termos">Conheça as regras da plataforma <Arrow /></Link></div><div className="trust-seal"><div className="seal-ring"><img src={kiximaMark} alt="" /><strong>FORNECEDOR<br />VERIFICADO</strong></div><div className="trust-list"><span><b>✓</b> Documentação validada</span><span><b>✓</b> Identidade empresarial confirmada</span><span><b>✓</b> Histórico e processo auditáveis</span></div></div></section>

    <section className="final-cta"><div className="final-pattern" aria-hidden="true"></div><div><p className="eyebrow">A SUA PRÓXIMA OPORTUNIDADE PODE COMEÇAR AQUI</p><h2>Faça parte da fonte.</h2><p>Registe a sua empresa e entre num novo ecossistema de procurement africano.</p></div><Link className="button button-light" to="/cadastro">Registar empresa <Arrow /></Link></section>

    <footer className="site-footer" id="contactos"><div className="footer-top"><div className="footer-brand"><Brand inverse /><p>Procurement garantido. Oportunidades ligadas. Capacidade africana visível.</p><div className="language"><span>🇦🇴</span> Português <b>⌄</b></div></div><div className="footer-column"><h3>Conheça a Kixima</h3><a href="#sobre">Sobre nós</a><a href="#historia">A nossa história</a><a href="#impacto">Impacto e conteúdo local</a><a id="noticias" href="#noticias">Notícias e perspectivas</a><a id="carreiras" href="#carreiras">Carreiras</a></div><div className="footer-column"><h3>Faça negócios connosco</h3><a href="#compradores">Comprar na Kixima</a><a href="#fornecedores">Vender na Kixima</a><Link to="/supplier-development">Supplier Development</Link><Link to="/parcerias">Parceiros internacionais</Link><Link to="/planos">Planos e preços</Link></div><div className="footer-column" id="ajuda"><h3>Confiança e suporte</h3><a id="faq" href="#faq">Perguntas frequentes</a><a id="recursos" href="#recursos">Guias e recursos</a><a href="#confianca">Fornecedor verificado</a><Link to="/login">Aceder à minha conta</Link><a href="mailto:geral@kixima.net">Contactar a Kixima</a></div></div><div className="footer-bottom"><span>© 2026 KIXIMA.NET. Todos os direitos reservados.</span><div><Link to="/termos">Termos de uso</Link><Link to="/privacidade">Política de privacidade</Link></div><span>Uma marca nascida em Angola.</span></div></footer>
  </main>;
}
