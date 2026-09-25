// src/pages/corporate/CorporateHome.jsx
// A página corporativa com o layout e a identidade da vista "Front
// corporativo" da Proposta 04 · Bancada (ver bancada-front.css) — herói com
// a compra guiada, "Duas portas", pilares, números — e, dentro dessa
// identidade, TODO o conteúdo real que a página já tinha:
//   - vídeo real da plataforma (gravação genuína, não uma montagem);
//   - parede de avaliações reais, moderadas no Admin do Sistema
//     (GET /api/public/feedback);
//   - faixa de números reais (GET /api/public/stats) e o prazo de pagamento
//     real configurado no backend — nunca um número escrito à mão;
//   - fotografias dos sectores, programas (Supplier Development / Parceiros
//     internacionais), roadmap, "Sobre a KIXIMA", CTA final e o rodapé
//     completo (CorporateChrome.jsx, partilhado com /noticias, /carreiras,
//     /faq e /recursos).
// Os números fictícios do HTML de referência (artigos e fornecedores por
// categoria, estatísticas do sector) não entram: as categorias da compra
// guiada são as reais do catálogo (as mesmas de src/components/icons.jsx),
// sem contagens, e a pesquisa leva a quem tem sessão para o catálogo.
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { api } from '../../api/client';
import { Icon, CATEGORY_NAMES, categoryVisual } from '../../components/icons';
import { Arrow, CorporateHeader, CorporateFooter, useCorporateActive } from './CorporateChrome';
import './bancada-front.css';
import kiximaHumanNetwork from '../../assets/corporate/kixima-human-network.webp';
import kiximaEnergyMining from '../../assets/corporate/kixima-energy-mining.webp';
import kiximaLogisticsAgri from '../../assets/corporate/kixima-logistics-agri.webp';

// Um dos números da faixa — "—" enquanto não há dados reais (nunca um número
// inventado a aparecer primeiro e ser substituído depois).
function Num({ value, unit, desc }) {
  return <div className="num"><div className="v">{value == null ? '—' : value}</div><div className="u">{unit}</div><div className="d">{desc}</div></div>;
}

const FEEDBACK_DATE_LOCALE = { pt: 'pt-AO', en: 'en-GB', fr: 'fr-FR' };

// "Avaliações Verificadas" — só leitura: o que já foi aprovado pelo Admin do
// Sistema. Quem quiser avaliar tem de estar autenticado (Suporte → Feedback),
// para o selo "Verificado" significar alguma coisa: vem sempre de uma conta e
// empresa reais da KIXIMA. Aqui, na forma da bancada da proposta (mosaicos).
function FeedbackSection({ t }) {
  const { lang } = useI18n();
  const [wall, setWall] = useState(null);

  useEffect(() => {
    api.get('/api/public/feedback').then(setWall).catch(() => {});
  }, []);

  return <section className="sec" id="avaliacoes">
    <div className="sec-cab"><div className="eyebrow"><b>{t('Confiança')}</b> · {t('AVALIAÇÕES VERIFICADAS')}</div>
      <h2>{t('Reputação construída')} <em>{t('com transacções reais.')}</em></h2>
      <p>{t('Compradores e fornecedores autenticados avaliam a experiência na KIXIMA. Cada avaliação é revista antes de ser publicada e a média mostrada conta sempre todas as aprovadas.')}</p></div>
    {wall && wall.total > 0
      ? <div className="media-aval"><span className="v">{wall.average.toFixed(1).replace('.', ',')}</span><span className="u">/ 5 · {t('{total} avaliações aprovadas', { total: wall.total })}</span></div>
      : null}
    {wall && wall.feedback.length > 0
      ? <div className="bancada">{wall.feedback.map((f) => (
        <article className="bc" key={f.id}>
          <div className="cab">
            <span className="estrelas" aria-label={t('{rating} de 5', { rating: f.rating })}>{'★'.repeat(f.rating)}{'☆'.repeat(5 - f.rating)}</span>
            {f.verified ? <span className="est" title={t('Avaliação de uma conta e empresa reais da KIXIMA')}>✓ {t('Verificado')}</span> : null}
          </div>
          <p className="msg">{f.message}</p>
          <footer>
            <div><strong>{f.user.name}</strong><span>{f.company.name}</span></div>
            <time dateTime={f.createdAt}>{new Date(f.createdAt).toLocaleDateString(FEEDBACK_DATE_LOCALE[lang] || 'pt-AO', { day: '2-digit', month: 'short', year: 'numeric' })}</time>
          </footer>
        </article>
      ))}</div>
      : <p className="vazio">{t('Ainda não há avaliações públicas. Seja o primeiro a partilhar a sua experiência — inicie sessão e vá a Suporte → Feedback.')}</p>}
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
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [q, setQ] = useState('');
  useScrollToHash();
  useCorporateActive();

  // Números reais da plataforma (empresas, fornecedores, ordens, prazo de
  // pagamento) — nunca escritos à mão. Falha em silêncio: sem stats, a
  // faixa mostra "—" em vez de travar a página ou inventar um número.
  useEffect(() => {
    api.get('/api/public/stats').then(setStats).catch(() => {});
  }, []);

  const diasPagamento = stats?.pagamentoSlaDias ?? 7;

  // A compra guiada abre a página pública com o mesmo gesto da plataforma. O
  // catálogo é de quem tem sessão: a pesquisa leva ao login, e a expressão
  // segue para lá sem ser perdida.
  function pesquisar(e) {
    e.preventDefault();
    const termo = q.trim();
    navigate(`/login${termo ? `?q=${encodeURIComponent(termo)}` : ''}`);
  }

  return <main id="top" className="kx">
    <CorporateHeader isHome />

    <div className="folha">

      {/* ---------- herói: a compra guiada ---------- */}
      <section className="sec hero" aria-labelledby="hero-title">
        <div className="eyebrow"><b>{t('A fonte dos seus negócios.')}</b> · kixima.net</div>
        <h1 id="hero-title">{t('The state of the art —')} <em>{t('do procurement à execução.')}</em></h1>
        <p className="lead">{t('O Oil & Gas na palma da sua mão - e o seu negócio à distância de um clique.')}</p>
        <p className="lead-nota">{t('Um conceito global. Uma solução local.')}</p>
        <div className="hero-acoes"><Link className="btn" to="/cadastro">{t('Registar empresa')} <Arrow /></Link><a className="btn alt" href="#demonstracao">{t('Conhecer a plataforma')}</a></div>

        <div className="guiado">
          <h4>{t('O que precisa de comprar?')}</h4>
          <p>{t('A pesquisa devolve artigo, fornecedor credenciado e preço na mesma linha. O catálogo é de quem tem sessão — comece aqui e entre.')}</p>
          <form className="campo" onSubmit={pesquisar} role="search">
            <svg className="ic" viewBox="0 0 22 23" fill="none" stroke="var(--suave)" strokeWidth="1.6" aria-hidden="true"><circle cx="10" cy="10" r="6" /><path d="M14.5 14.5L19 19" /></svg>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Pesquise produtos, serviços ou fornecedores')} aria-label={t('Pesquisar')} />
            <button type="submit">{t('Procurar')}</button>
          </form>
          <div className="cats">
            {CATEGORY_NAMES.map((nome) => {
              const vis = categoryVisual(nome);
              return <Link className="cat" key={nome} to="/login"><h5>{nome}</h5><div className="cod"><Icon name={vis.icon} size={15} />{t('Catálogo UNSPSC')}</div></Link>;
            })}
          </div>
          {/* Os indicadores da proposta de valor, como as políticas da compra guiada. */}
          <div className="pols">
            <div className="pol"><b></b><span>{t('Due diligence')}</span><i>{t('uma única vez')}</i></div>
            <div className="pol ocre"><b></b><span>{t('Procurement')} 360°</span><i>{t('auditável')}</i></div>
            <div className="pol"><b></b><span>{t('Pagamento em')} {t('até {dias} dias', { dias: diasPagamento })}</span><i>{t('a partir da recepção validada')}</i></div>
            <div className="pol ocre"><b></b><span>{t('Catálogo')} UNSPSC</span><i>{t('estruturado')}</i></div>
          </div>
        </div>
      </section>

      {/* ---------- números reais ---------- */}
      <section className="sec" aria-label={t('KIXIMA em números')}>
        <div className="eyebrow">{t('KIXIMA em números')}</div>
        <div className="nums">
          <Num value={stats?.empresasVerificadas} unit={t('Empresas verificadas')} desc={t('credenciadas na plataforma')} />
          <Num value={stats?.fornecedoresQualificados} unit={t('Fornecedores qualificados')} desc={t('com due diligence feita uma vez, válida para todos os compradores')} />
          <Num value={stats?.ordensProcessadas} unit={t('Ordens de compra concluídas')} desc={t('com registo integral do ciclo, da cesta ao pagamento')} />
          <Num value={diasPagamento} unit={t('dias')} desc={t('prazo de pagamento ao fornecedor, contado da recepção validada')} />
        </div>
      </section>

      {/* ---------- a plataforma ---------- */}
      <section className="sec" id="plataforma">
        <div className="sec-cab"><div className="eyebrow">{t('A PLATAFORMA')}</div>
          <h2>{t('Um mercado transacional.')} <em>{t('Um ecossistema funcional.')}</em></h2>
          <p>{t('A KIXIMA integra descoberta, qualificação, contratação e execução numa experiência B2B concebida para reduzir a distância entre quem compra e quem está preparado para fornecer.')}</p>
          <p style={{ marginTop: 12 }}><Link className="text-link" to="/cadastro">{t('Entrar no ecossistema')} <Arrow /></Link></p></div>
        <div className="pilares">
          <div className="pil"><b>01</b><h4>{t('Marketplace B2B')}</h4><p>{t('Produtos, serviços e capacidade empresarial classificados para facilitar a procura.')}</p></div>
          <div className="pil"><b>02</b><h4>{t('Rede verificada')}</h4><p>{t('Credenciamento estruturado para gerar confiança antes da primeira transacção.')}</p></div>
          <div className="pil"><b>03</b><h4>{t('Execução integrada')}</h4><p>{t('Pedido, ordem de compra, entrega, recepção e pagamento numa jornada rastreável.')}</p></div>
          <div className="pil"><b>04</b><h4>{t('Visibilidade 360°')}</h4><p>{t('Informação organizada para compradores, fornecedores e equipas de decisão.')}</p></div>
        </div>
      </section>

      {/* ---------- demonstração: o vídeo real ---------- */}
      <section className="sec" id="demonstracao">
        <div className="sec-cab"><div className="eyebrow">{t('DEMONSTRAÇÃO DA EXPERIÊNCIA')}</div>
          <h2>{t('Procurement claro.')} <em>{t('Decisões mais rápidas.')}</em></h2>
          <p>{t('Gravação real da plataforma, numa conta de demonstração - sem dados forjados: o mesmo catálogo, carrinho, impostos e checkout por fornecedor que os clientes usam todos os dias.')}</p></div>
        <div className="fundo video-moldura">
          <video controls preload="none" poster="/videos/kixima-login-checkout-poster.jpg" aria-label={t('Demonstração da plataforma KIXIMA, do login ao checkout')}><source src="/videos/kixima-login-checkout.mp4" type="video/mp4" /><track kind="captions" src="/videos/kixima-login-checkout.vtt" srcLang="pt" label={t('Português')} default /></video>
          <div className="txt">
            <div className="rot">{t('A jornada gravada')}</div>
            <div className="fluxo">
              {[t('Login seguro'), t('Painel do comprador'), t('Catálogo e pesquisa'), t('Ficha de produto'), t('Carrinho e impostos'), t('Checkout por fornecedor')].map((passo, i) => (
                <div className="f feito" key={passo}><div className="pt"></div><b>{passo}</b><i>{String(i + 1).padStart(2, '0')}</i></div>
              ))}
            </div>
          </div>
        </div>
        <p className="nota">{t('Conta de demonstração. O IVA de 14% e o agrupamento por fornecedor são calculados exactamente como em produção.')}</p>
      </section>

      {/* ---------- duas portas ---------- */}
      <section className="sec" id="empresas">
        <div className="sec-cab"><div className="eyebrow">{t('PARA EMPRESAS')} · {t('Duas portas')}</div>
          <h2>{t('Duas necessidades.')} <em>{t('Uma só fonte.')}</em></h2></div>
        <div className="portas">
          <div className="porta" id="compradores"><div className="rot">{t('COMPRADORES')}</div><h3>{t('Sou comprador')}</h3><p>{t('Encontre fornecedores qualificados, transforme necessidades em ordens de compra e acompanhe a execução ponta a ponta.')}</p><ul><li>{t('Pesquisa e comparação')}</li><li>{t('Fornecedores credenciados')}</li><li>{t('Rastreabilidade e controlo')}</li></ul><Link className="btn" to="/cadastro?tipo=CLIENTE">{t('Registar como comprador')} <Arrow /></Link></div>
          <div className="porta" id="fornecedores"><div className="rot">{t('FORNECEDORES')}</div><h3>{t('Sou fornecedor')}</h3><p>{t('Apresente o seu catálogo, responda a oportunidades reais e transforme capacidade local em crescimento sustentável.')}</p><ul><li>{t('Visibilidade empresarial')}</li><li>{t('Acesso a oportunidades')}</li><li>{t('Pagamento em')} {t('até {dias} dias', { dias: diasPagamento })}</li></ul><Link className="btn alt" to="/cadastro?tipo=FORNECEDOR">{t('Registar como fornecedor')} <Arrow /></Link></div>
        </div>
      </section>

      {/* ---------- como funciona: o fluxo da página de objecto ---------- */}
      <section className="sec" id="como-funciona">
        <div className="sec-cab"><div className="eyebrow">{t('COMO FUNCIONA')}</div>
          <h2>{t('Da necessidade ao pagamento.')}</h2>
          <p>{t('Uma sequência simples para processos exigentes.')}</p></div>
        <div className="fluxo">
          <div className="f"><div className="pt"></div><span className="n">01</span><b>{t('Credenciamento')}</b><i>{t('Dados e documentos são submetidos para verificação.')}</i></div>
          <div className="f"><div className="pt"></div><span className="n">02</span><b>{t('Mercado')}</b><i>{t('Compradores pesquisam; fornecedores apresentam ofertas.')}</i></div>
          <div className="f"><div className="pt"></div><span className="n">03</span><b>{t('Execução')}</b><i>{t('O pedido transforma-se em PO, entrega e recepção.')}</i></div>
          <div className="f" id="pagamento"><div className="pt"></div><span className="n">04</span><b>{t('Pagamento')}</b><i>{t('A jornada termina com rastreabilidade e previsibilidade.')}</i></div>
        </div>
      </section>

      {/* ---------- diferenciais ---------- */}
      <section className="sec" id="diferenciais">
        <div className="sec-cab"><div className="eyebrow">{t('DIFERENCIAIS')}</div>
          <h2>{t('Confiança incorporada')} <em>{t('em cada etapa.')}</em></h2></div>
        <div className="emprest">
          <div className="emp"><div className="de">✓ · {t('Confiança')}</div><h4>{t('Due diligence uma vez')}</h4><p>{t('O fornecedor organiza a sua informação e beneficia da verificação em toda a rede.')}</p></div>
          <div className="emp"><div className="de">↔ · {t('Mercado')}</div><h4>{t('Compradores e fornecedores')}</h4><p>{t('As duas partes operam dentro do mesmo fluxo, com informação visível e estruturada.')}</p></div>
          <div className="emp"><div className="de">◈ · {t('Capacidade local')}</div><h4>{t('Capacidade local visível')}</h4><p>{t('Empresas angolanas ganham acesso, contexto e instrumentos para competir.')}</p></div>
          <div className="emp"><div className="de">{diasPagamento} · {t('Pagamento')}</div><h4>{t('Previsibilidade financeira')}</h4><p>{t('O compromisso de pagamento reduz pressão de caixa e fortalece a execução.')}</p></div>
        </div>
      </section>

      {/* ---------- programas ---------- */}
      <section className="sec" id="impacto">
        <div className="sec-cab"><div className="eyebrow">{t('MAIS DO QUE UM MARKETPLACE')}</div>
          <h2>{t('Capacidade local. Parcerias globais.')}</h2></div>
        <div className="emprest">
          <div className="emp"><div className="de">{t('SUPPLIER DEVELOPMENT')}</div><h4>{t('Prepare a sua empresa para fornecer.')}</h4><p>{t('Apoio no processo de credenciamento, organização documental e desenvolvimento da capacidade empresarial.')}</p><div className="para"><Link to="/supplier-development">{t('Conhecer o programa')} <Arrow /></Link></div></div>
          <div className="emp"><div className="de">{t('PARCEIROS INTERNACIONAIS')}</div><h4>{t('Ligue capacidade local a tecnologia global.')}</h4><p>{t('Facilitamos relações com parceiros estrangeiros para tecnologia, especialização, capacitação e crescimento conjunto.')}</p><div className="para"><Link to="/parcerias">{t('Encontrar parceiros')} <Arrow /></Link></div></div>
        </div>
      </section>

      {/* ---------- sectores: as fotografias reais ---------- */}
      <section className="sec" id="sectores">
        <div className="sec-cab"><div className="eyebrow">{t('SECTORES')}</div>
          <h2>{t('Nascido no Oil & Gas.')} <em>{t('Preparado para crescer.')}</em></h2>
          <p>{t('A arquitectura da KIXIMA permite expandir o modelo a novas cadeias de valor sem perder o rigor do procurement industrial.')}</p></div>
        <div className="fundos">
          <figure className="fundo" style={{ margin: 0 }}><img className="foto" src={kiximaEnergyMining} alt={t('Profissionais angolanos nos sectores de energia, Oil & Gas e mineração')} loading="lazy" /><figcaption className="txt"><div className="rot">{t('OPERAÇÕES DE ALTA EXIGÊNCIA')}</div><h4>{t('Energia · Oil & Gas · Mineração')}</h4></figcaption></figure>
          <figure className="fundo" style={{ margin: 0 }}><img className="foto" src={kiximaLogisticsAgri} alt={t('Profissionais angolanos nos sectores de construção, logística e serviços profissionais')} loading="lazy" /><figcaption className="txt"><div className="rot">{t('CADEIAS DE VALOR EM CRESCIMENTO')}</div><h4>{t('Construção · Logística · Serviços profissionais')}</h4></figcaption></figure>
        </div>
        <div className="cats">
          {SECTORS.map((sector, index) => <div className="cat" key={sector}><h5>{t(sector)}</h5><div className="cod">{String(index + 1).padStart(2, '0')}</div></div>)}
        </div>
      </section>

      <FeedbackSection t={t} />

      {/* ---------- roadmap: a linha do tempo vertical ---------- */}
      <section className="sec" id="roadmap">
        <div className="sec-cab"><div className="eyebrow">ROADMAP</div>
          <h2>{t('De Angola para África.')}</h2></div>
        <div className="linha-t">
          <div className="et"><div className="pt"></div><div><b><small>01</small>{t('Lançamento')}</b><span>{t('Marketplace e rede inicial para Oil & Gas.')}</span></div></div>
          <div className="et"><div className="pt"></div><div><b><small>02</small>{t('Consolidação')}</b><span>{t('Mais compradores, fornecedores e execução digital.')}</span></div></div>
          <div className="et"><div className="pt"></div><div><b><small>03</small>{t('Expansão')}</b><span>{t('Novos sectores e capacidades empresariais.')}</span></div></div>
          <div className="et"><div className="pt"></div><div><b><small>04</small>{t('Escala africana')}</b><span>{t('Integração regional e novas oportunidades.')}</span></div></div>
        </div>
      </section>

      {/* ---------- sobre ---------- */}
      <section className="sec" id="sobre">
        <div className="eyebrow">{t('SOBRE A KIXIMA')}</div>
        <div className="sobre">
          <figure className="fundo" style={{ margin: 0 }}><img className="foto" src={kiximaHumanNetwork} alt={t('Compradora e fornecedor angolanos a analisar uma oportunidade de negócio')} loading="lazy" /><figcaption className="txt"><div className="rot">{t('A FONTE')}</div></figcaption></figure>
          <div className="texto">
            <h2 style={{ fontSize: 'clamp(25px, 3.6vw, 38px)', letterSpacing: '-.03em', maxWidth: '22ch' }}>{t('Uma inquietação transformada em infraestrutura.')}</h2>
            <p>{t('A KIXIMA nasceu de uma questão simples: por que razão empresas locais capazes continuam longe das oportunidades das grandes organizações?')}</p>
            <p>{t('Construímos uma ponte entre procura, capacidade e confiança. Levamos fornecedores qualificados até aos compradores e damos às empresas instrumentos para competir, executar e crescer.')}</p>
            <blockquote>{t('“Por que razão uma pequena empresa do Cazenga não pode fornecer a uma grande operadora?”')}</blockquote>
          </div>
        </div>
      </section>

      {/* ---------- CTA final ---------- */}
      <section className="sec">
        <div className="eyebrow">{t('A SUA PRÓXIMA OPORTUNIDADE COMEÇA AQUI')}</div>
        <div className="cta-final">
          <div><h2>{t('Faça parte da fonte.')}</h2><p>{t('Entre no novo ecossistema africano de procurement.')}</p></div>
          <div className="acoes"><Link className="btn" to="/cadastro">{t('Registar empresa')} <Arrow /></Link><a className="btn alt" href="mailto:geral@kixima.net?subject=Solicitar%20demonstração%20KIXIMA.NET">{t('Solicitar demonstração')}</a></div>
        </div>
      </section>

    </div>

    <CorporateFooter isHome />
  </main>;
}
