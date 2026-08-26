// src/pages/corporate/CorporateHome.jsx
// Porta de app/page.tsx do pacote "KIXIMA_FRONTEND_SELECTED_EXACT" (2ª
// geração do design da página corporativa KIXIMA.NET — mesma estrutura,
// mesmas classes CSS (ver corporate.css), mesmo texto por omissão
// (português). Mudanças em relação ao original:
//   1. Os links que no original apontavam para "https://kixima.net/..."
//      passam a rotas relativas via <Link> — já vivem no mesmo sítio.
//   2. "Registar como comprador/fornecedor" incluem ?tipo=CLIENTE|
//      FORNECEDOR, lidos por Register.jsx para pré-selecionar o tipo.
//   3. As imagens são import ES em vez de caminhos de public/ (Next.js).
//   4. Todo o texto passa pelo sistema de tradução do KIXIMA (useI18n/t) —
//      a chave é o próprio texto em português, exactamente como no resto
//      da app (ver src/i18n/index.jsx).
//   5. Duas secções do pacote de origem usam conteúdo fabricado — uma
//      maquete decorativa em "Demonstração" e um cartão placeholder "em
//      breve" em "Avaliações". Aqui ficam, respectivamente, o vídeo real de
//      ecrã da plataforma (gravação genuína, não uma montagem) e a parede
//      de avaliações real, com moderação no Admin do Sistema (GET
//      /api/public/feedback) — construída em versões anteriores desta
//      página e mantida propositadamente ao adoptar este novo visual, para
//      não perder funcionalidade real por uma versão fabricada ("sem
//      quebrar o que já funciona"). A submissão em si já não vive aqui:
//      passou a exigir sessão iniciada (ver src/pages/shared/
//      SuporteFeedback.jsx, POST /api/feedback) para o selo "Verificado"
//      significar alguma coisa.
//   6. Uma faixa de estatísticas reais ("stats-strip", GET /api/public/stats)
//      e o indicador "07 · Pagamento em 7 dias" (secção "metrics") usam o
//      prazo real configurado no backend em vez de texto fixo — pedido
//      explícito do utilizador, para "nada ser estático" nesta página; não
//      existe em nenhuma versão do design de referência.
//   7. A secção "Programas" (Supplier Development / Parceiros
//      internacionais) é específica do KIXIMA e não existe no design de
//      referência — mantida por serem páginas e programas reais da
//      plataforma.
//   8. Cabeçalho/rodapé/navegação vivem em CorporateChrome.jsx, partilhados
//      com /noticias, /carreiras, /faq e /recursos — useScrollToHash()
//      garante que os links de secção funcionam mesmo vindos de outra
//      página.
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { api } from '../../api/client';
import { Arrow, CorporateHeader, CorporateFooter, useCorporateActive } from './CorporateChrome';
import './corporate.css';
import kiximaMark from '../../assets/brand/kixima-mark.png';
import kiximaHumanNetwork from '../../assets/corporate/kixima-human-network.webp';
import kiximaEnergyMining from '../../assets/corporate/kixima-energy-mining.webp';
import kiximaLogisticsAgri from '../../assets/corporate/kixima-logistics-agri.webp';

// Maquete decorativa da plataforma (formas e rótulos genéricos desenhados em
// CSS, não uma captura de ecrã) — usada só como ilustração de marca no herói.
// Na secção "Demonstração" real usa-se o vídeo genuíno em vez desta maquete.
function DashboardMockup({ compact = false, t }) {
  return <div className={`dashboard-shell ${compact ? 'dashboard-compact' : ''}`} aria-label={t('Pré-visualização da plataforma KIXIMA')}>
    <div className="dashboard-top"><span className="brand brand-compact" aria-hidden="true"><img src={kiximaMark} alt="" /><span>KIXIMA<small>.NET</small></span></span><nav><span>{t('Visão geral')}</span><span>{t('Mercado')}</span><span>{t('Fornecedores')}</span></nav><i>AO</i></div>
    <aside><b>+</b><span></span><span></span><span></span><span></span></aside>
    <div className="dashboard-body"><p>{t('BOM DIA')}</p><h3>{t('O que precisa comprar?')}</h3><div className="search-bar"><span>{t('Pesquise produtos, serviços ou fornecedores')}</span><b>⌕</b></div><div className="dashboard-kpis"><article><span>{t('FORNECEDORES')}</span><strong>{t('Rede verificada')}</strong><i className="dot green"></i></article><article><span>{t('PROCESSO')}</span><strong>{t('360° auditável')}</strong><i className="dot gold"></i></article><article><span>{t('PAGAMENTO')}</span><strong>{t('Até 7 dias')}</strong><i className="dot red"></i></article></div><div className="dashboard-table"><div><b>{t('Oportunidades recentes')}</b><span>{t('Estado')}</span></div><div><p>{t('Equipamento industrial')}</p><i>{t('ABERTO')}</i></div><div><p>{t('Serviços de inspecção')}</p><i>{t('EM ANÁLISE')}</i></div></div></div>
  </div>;
}

// Um dos 3 números da faixa de estatísticas — "—" enquanto não há dados
// reais ainda (nunca um número inventado a aparecer primeiro e ser
// substituído depois).
function Stat({ value, label }) {
  return <div className="stat"><strong>{value == null ? '—' : `${value}+`}</strong><span>{label}</span></div>;
}

// "Avaliações Verificadas" — só leitura: mostra o que já foi aprovado pelo
// Admin do Sistema. Já não há formulário aqui — quem quiser avaliar tem de
// estar autenticado (Suporte → Feedback, dentro da app), precisamente para
// que o selo "Verificado" signifique alguma coisa: vem sempre de uma conta e
// empresa reais da KIXIMA, nunca de um nome digitado à mão por um visitante
// anónimo (ver src/pages/shared/SuporteFeedback.jsx e feedbackService.js).
const FEEDBACK_DATE_LOCALE = { pt: 'pt-AO', en: 'en-GB', fr: 'fr-FR' };

function FeedbackSection({ t }) {
  const { lang } = useI18n();
  const [wall, setWall] = useState(null);

  useEffect(() => {
    api.get('/api/public/feedback').then(setWall).catch(() => {});
  }, []);

  return <section className="section feedback" id="avaliacoes"><div className="section-title"><p className="eyebrow"><i></i>{t('AVALIAÇÕES VERIFICADAS')}</p><h2>{t('Reputação construída')}<br /><em>{t('com transacções reais.')}</em></h2><p>{t('Compradores e fornecedores autenticados avaliam a experiência na KIXIMA. Cada avaliação é revista antes de ser publicada e a média mostrada conta sempre todas as aprovadas.')}</p></div>
    <div className="feedback-wall feedback-wall-full">
      {wall && wall.total > 0
        ? <p className="feedback-average"><strong>{wall.average.toFixed(1).replace('.', ',')}</strong> / 5 · {t('{total} avaliações aprovadas', { total: wall.total })}</p>
        : null}
      {wall && wall.feedback.length > 0
        ? <div className="feedback-cards">{wall.feedback.map((f) => (
          <article className="feedback-card" key={f.id}>
            <div className="feedback-card-head">
              <div className="feedback-stars" aria-label={t('{rating} de 5', { rating: f.rating })} aria-hidden="true">{'★'.repeat(f.rating)}{'☆'.repeat(5 - f.rating)}</div>
              {f.verified ? <span className="feedback-verified" title={t('Avaliação de uma conta e empresa reais da KIXIMA')}>✓ {t('Verificado')}</span> : null}
            </div>
            <p>{f.message}</p>
            <footer>
              <div><strong>{f.user.name}</strong><span>{f.company.name}</span></div>
              <time dateTime={f.createdAt}>{new Date(f.createdAt).toLocaleDateString(FEEDBACK_DATE_LOCALE[lang] || 'pt-AO', { day: '2-digit', month: 'short', year: 'numeric' })}</time>
            </footer>
          </article>
        ))}</div>
        : <p className="feedback-empty">{t('Ainda não há avaliações públicas. Seja o primeiro a partilhar a sua experiência — inicie sessão e vá a Suporte → Feedback.')}</p>}
    </div>
  </section>;
}

// Os links de secção (menu e rodapé) navegam sempre para "/#secção", mesmo
// vindos de outra página — este hook garante que, ao chegar (ou ao mudar de
// hash na própria home), a página desce até à secção certa.
function useScrollToHash() {
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash]);
}

const SECTORS = ['Oil & Gas', 'Energia', 'Mineração', 'Construção', 'Logística', 'Serviços profissionais'];

export default function CorporateHome() {
  const { t } = useI18n();
  const [stats, setStats] = useState(null);
  useScrollToHash();
  useCorporateActive();

  // Números reais da plataforma (empresas, fornecedores, ordens, prazo de
  // pagamento) — nunca escritos à mão. Falha em silêncio: sem stats, a
  // faixa mostra "—" em vez de travar a página ou inventar um número.
  useEffect(() => {
    api.get('/api/public/stats').then(setStats).catch(() => {});
  }, []);

  const diasPagamento = stats?.pagamentoSlaDias ?? 7;

  return <main id="top" className="kixima-corp">
    <CorporateHeader isHome />

    <section className="hero" aria-labelledby="hero-title"><div className="hero-copy"><p className="eyebrow"><i></i>{t('A fonte dos seus negócios.')}</p><h1 id="hero-title">{t('The state of the art —')} <em>{t('do procurement à execução.')}</em></h1><p className="hero-lead">{t('O Oil & Gas na palma da sua mão - e o seu negócio à distância de um clique.')}</p><p className="hero-note">{t('Um conceito global. Uma solução local.')}</p><div className="hero-actions"><Link className="button button-primary" to="/cadastro">{t('Registar empresa')} <Arrow /></Link><a className="button button-secondary" href="#demonstracao">{t('Conhecer a plataforma')}</a></div></div><div className="hero-product"><div className="product-halo"></div><DashboardMockup compact t={t} /><div className="sam-diamond d-one"></div><div className="sam-diamond d-two"></div><div className="sam-diamond d-three"></div></div></section>

    <section className="stats-strip" aria-label={t('KIXIMA em números')}>
      <div className="stats-grid">
        <Stat value={stats?.empresasVerificadas} label={t('Empresas verificadas')} />
        <Stat value={stats?.fornecedoresQualificados} label={t('Fornecedores qualificados')} />
        <Stat value={stats?.ordensProcessadas} label={t('Ordens de compra concluídas')} />
      </div>
    </section>

    <section className="metrics" aria-label={t('Indicadores da proposta de valor')}><article><strong>01×</strong><span>{t('Due diligence')}<br />{t('uma única vez')}</span></article><article><strong>360°</strong><span>{t('Procurement')}<br />{t('auditável')}</span></article><article><strong>{diasPagamento}</strong><span>{t('Pagamento em')}<br />{t('até {dias} dias', { dias: diasPagamento })}</span></article><article><strong>UNSPSC</strong><span>{t('Catálogo')}<br />{t('estruturado')}</span></article></section>

    <section className="section platform" id="plataforma"><div className="section-title"><p className="eyebrow"><i></i>{t('A PLATAFORMA')}</p><h2>{t('Um mercado transacional.')}<br /><em>{t('Um ecossistema funcional.')}</em></h2></div><div className="platform-intro"><p>{t('A KIXIMA integra descoberta, qualificação, contratação e execução numa experiência B2B concebida para reduzir a distância entre quem compra e quem está preparado para fornecer.')}</p><Link className="text-link" to="/cadastro">{t('Entrar no ecossistema')} <Arrow /></Link></div><div className="platform-grid"><article><span>01</span><h3>{t('Marketplace B2B')}</h3><p>{t('Produtos, serviços e capacidade empresarial classificados para facilitar a procura.')}</p></article><article><span>02</span><h3>{t('Rede verificada')}</h3><p>{t('Credenciamento estruturado para gerar confiança antes da primeira transacção.')}</p></article><article><span>03</span><h3>{t('Execução integrada')}</h3><p>{t('Pedido, ordem de compra, entrega, recepção e pagamento numa jornada rastreável.')}</p></article><article><span>04</span><h3>{t('Visibilidade 360°')}</h3><p>{t('Informação organizada para compradores, fornecedores e equipas de decisão.')}</p></article></div></section>

    <section className="section demo" id="demonstracao"><div className="section-title"><p className="eyebrow"><i></i>{t('DEMONSTRAÇÃO DA EXPERIÊNCIA')}</p><h2>{t('Procurement claro.')}<br /><em>{t('Decisões mais rápidas.')}</em></h2><p>{t('Gravação real da plataforma, numa conta de demonstração - sem dados forjados: o mesmo catálogo, carrinho, impostos e checkout por fornecedor que os clientes usam todos os dias.')}</p></div>
      <div className="demo-frame"><video controls preload="none" poster="/videos/kixima-login-checkout-poster.jpg" aria-label={t('Demonstração da plataforma KIXIMA, do login ao checkout')}><source src="/videos/kixima-login-checkout.mp4" type="video/mp4" /><track kind="captions" src="/videos/kixima-login-checkout.vtt" srcLang="pt" label={t('Português')} default /></video></div>
      <ol className="demo-journey"><li>{t('Login seguro')}</li><li>{t('Painel do comprador')}</li><li>{t('Catálogo e pesquisa')}</li><li>{t('Ficha de produto')}</li><li>{t('Carrinho e impostos')}</li><li>{t('Checkout por fornecedor')}</li></ol>
      <p className="demo-note">{t('Conta de demonstração. O IVA de 14% e o agrupamento por fornecedor são calculados exactamente como em produção.')}</p>
    </section>

    <section className="section business" id="empresas"><div className="section-title"><p className="eyebrow"><i></i>{t('PARA EMPRESAS')}</p><h2>{t('Duas necessidades.')}<br /><em>{t('Uma só fonte.')}</em></h2></div><div className="business-grid">
      <article className="buyer-card" id="compradores"><span>{t('COMPRADORES')}</span><h3>{t('Mais escolha.')}<br />{t('Mais controlo.')}</h3><p>{t('Encontre fornecedores qualificados, transforme necessidades em ordens de compra e acompanhe a execução ponta a ponta.')}</p><ul><li>{t('Pesquisa e comparação')}</li><li>{t('Fornecedores credenciados')}</li><li>{t('Rastreabilidade e controlo')}</li></ul><Link to="/cadastro?tipo=CLIENTE">{t('Registar como comprador')} <Arrow /></Link></article>
      <article className="supplier-card" id="fornecedores"><span>{t('FORNECEDORES')}</span><h3>{t('Mais mercado.')}<br />{t('Mais previsibilidade.')}</h3><p>{t('Apresente o seu catálogo, responda a oportunidades reais e transforme capacidade local em crescimento sustentável.')}</p><ul><li>{t('Visibilidade empresarial')}</li><li>{t('Acesso a oportunidades')}</li><li>{t('Pagamento em até 7 dias')}</li></ul><Link to="/cadastro?tipo=FORNECEDOR">{t('Registar como fornecedor')} <Arrow /></Link></article>
    </div></section>

    <section className="process-section" id="como-funciona"><div className="section-title light"><p className="eyebrow"><i></i>{t('COMO FUNCIONA')}</p><h2>{t('Da necessidade ao pagamento.')}</h2><p>{t('Uma sequência simples para processos exigentes.')}</p></div><ol><li><span>01</span><i></i><h3>{t('Credenciamento')}</h3><p>{t('Dados e documentos são submetidos para verificação.')}</p></li><li><span>02</span><i></i><h3>{t('Mercado')}</h3><p>{t('Compradores pesquisam; fornecedores apresentam ofertas.')}</p></li><li><span>03</span><i></i><h3>{t('Execução')}</h3><p>{t('O pedido transforma-se em PO, entrega e recepção.')}</p></li><li id="pagamento"><span>04</span><i></i><h3>{t('Pagamento')}</h3><p>{t('A jornada termina com rastreabilidade e previsibilidade.')}</p></li></ol></section>

    <section className="section differentiators" id="diferenciais"><div className="section-title"><p className="eyebrow"><i></i>{t('DIFERENCIAIS')}</p><h2>{t('Confiança incorporada')}<br /><em>{t('em cada etapa.')}</em></h2></div><div className="difference-grid"><article><b>✓</b><h3>{t('Due diligence uma vez')}</h3><p>{t('O fornecedor organiza a sua informação e beneficia da verificação em toda a rede.')}</p></article><article><b>↔</b><h3>{t('Compradores e fornecedores')}</h3><p>{t('As duas partes operam dentro do mesmo fluxo, com informação visível e estruturada.')}</p></article><article><b>◈</b><h3>{t('Capacidade local visível')}</h3><p>{t('Empresas angolanas ganham acesso, contexto e instrumentos para competir.')}</p></article><article><b>7</b><h3>{t('Previsibilidade financeira')}</h3><p>{t('O compromisso de pagamento reduz pressão de caixa e fortalece a execução.')}</p></article></div></section>

    <section className="programs" id="impacto"><div className="programs-inner"><div className="programs-heading"><p className="eyebrow"><i></i>{t('MAIS DO QUE UM MARKETPLACE')}</p><h2>{t('Capacidade local. Parcerias globais.')}</h2></div><div className="program-cards"><article><span>SD</span><p className="eyebrow">{t('SUPPLIER DEVELOPMENT')}</p><h3>{t('Prepare a sua empresa para fornecer.')}</h3><p>{t('Apoio no processo de credenciamento, organização documental e desenvolvimento da capacidade empresarial.')}</p><Link to="/supplier-development">{t('Conhecer o programa')} <Arrow /></Link></article><article><span>↔</span><p className="eyebrow">{t('PARCEIROS INTERNACIONAIS')}</p><h3>{t('Ligue capacidade local a tecnologia global.')}</h3><p>{t('Facilitamos relações com parceiros estrangeiros para tecnologia, especialização, capacitação e crescimento conjunto.')}</p><Link to="/parcerias">{t('Encontrar parceiros')} <Arrow /></Link></article></div></div></section>

    <section className="sectors" id="sectores"><div className="section-title"><p className="eyebrow"><i></i>{t('SECTORES')}</p><h2>{t('Nascido no Oil & Gas.')}<br /><em>{t('Preparado para crescer.')}</em></h2><p>{t('A arquitectura da KIXIMA permite expandir o modelo a novas cadeias de valor sem perder o rigor do procurement industrial.')}</p></div>
      <div className="sector-visuals"><figure><img src={kiximaEnergyMining} alt={t('Profissionais angolanos nos sectores de energia, Oil & Gas e mineração')} loading="lazy" /><figcaption><span>{t('OPERAÇÕES DE ALTA EXIGÊNCIA')}</span><b>{t('Energia · Oil & Gas · Mineração')}</b></figcaption></figure><figure><img src={kiximaLogisticsAgri} alt={t('Profissionais angolanos nos sectores de construção, logística e serviços profissionais')} loading="lazy" /><figcaption><span>{t('CADEIAS DE VALOR EM CRESCIMENTO')}</span><b>{t('Construção · Logística · Serviços profissionais')}</b></figcaption></figure></div>
      <div>{SECTORS.map((sector, index) => <article key={sector}><span>{String(index + 1).padStart(2, '0')}</span><h3>{t(sector)}</h3><Arrow /></article>)}</div></section>

    <FeedbackSection t={t} />

    <section className="roadmap" id="roadmap"><div className="section-title light"><p className="eyebrow"><i></i>ROADMAP</p><h2>{t('De Angola para África.')}</h2></div><ol><li><span>01</span><h3>{t('Lançamento')}</h3><p>{t('Marketplace e rede inicial para Oil & Gas.')}</p></li><li><span>02</span><h3>{t('Consolidação')}</h3><p>{t('Mais compradores, fornecedores e execução digital.')}</p></li><li><span>03</span><h3>{t('Expansão')}</h3><p>{t('Novos sectores e capacidades empresariais.')}</p></li><li><span>04</span><h3>{t('Escala africana')}</h3><p>{t('Integração regional e novas oportunidades.')}</p></li></ol></section>

    <section className="section about" id="sobre"><div className="about-mark"><img src={kiximaHumanNetwork} alt={t('Compradora e fornecedor angolanos a analisar uma oportunidade de negócio')} loading="lazy" /><span>{t('A FONTE')}</span></div><div><p className="eyebrow"><i></i>{t('SOBRE A KIXIMA')}</p><h2>{t('Uma inquietação transformada em infraestrutura.')}</h2><p>{t('A KIXIMA nasceu de uma questão simples: por que razão empresas locais capazes continuam longe das oportunidades das grandes organizações?')}</p><p>{t('Construímos uma ponte entre procura, capacidade e confiança. Levamos fornecedores qualificados até aos compradores e damos às empresas instrumentos para competir, executar e crescer.')}</p><blockquote>{t('“Por que razão uma pequena empresa do Cazenga não pode fornecer a uma grande operadora?”')}</blockquote></div></section>

    <section className="final-cta"><div><p className="eyebrow"><i></i>{t('A SUA PRÓXIMA OPORTUNIDADE COMEÇA AQUI')}</p><h2>{t('Faça parte da fonte.')}</h2><p>{t('Entre no novo ecossistema africano de procurement.')}</p></div><div><Link className="button light-button" to="/cadastro">{t('Registar empresa')} <Arrow /></Link><a className="button dark-button" href="mailto:geral@kixima.net?subject=Solicitar%20demonstração%20KIXIMA.NET">{t('Solicitar demonstração')}</a></div></section>

    <CorporateFooter isHome />
  </main>;
}
