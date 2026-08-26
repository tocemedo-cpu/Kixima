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
//   6. Cabeçalho/rodapé/navegação foram extraídos para CorporateChrome.jsx
//      e passaram a ser partilhados com as novas páginas /noticias,
//      /carreiras, /faq e /recursos — os itens de menu que antes eram
//      âncoras sem destino real ("Notícias", "Carreiras", "Perguntas
//      frequentes", "Guias e recursos") agora apontam para páginas
//      próprias, e useScrollToHash() garante que os links de secção
//      (ex.: "Sobre a Kixima") funcionam mesmo vindos de outra página.
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { api } from '../../api/client';
import { Arrow, CorporateHeader, CorporateFooter, useCorporateActive } from './CorporateChrome';
import './corporate.css';
import kiximaMark from '../../assets/brand/kixima-mark.png';
import kiximaMarkReversed from '../../assets/brand/kixima-mark-reversed.png';
import kiximaHumanNetwork from '../../assets/corporate/kixima-human-network.webp';
import kiximaEnergyMining from '../../assets/corporate/kixima-energy-mining.webp';
import kiximaLogisticsAgri from '../../assets/corporate/kixima-logistics-agri.webp';

// Um dos 3 números da faixa de estatísticas — "—" enquanto não há dados
// reais ainda (nunca um número inventado a aparecer primeiro e ser
// substituído depois).
function Stat({ value, label }) {
  return <div className="stat"><strong>{value == null ? '—' : `${value}+`}</strong><span>{label}</span></div>;
}

const FEEDBACK_ROLES = ['Comprador', 'Fornecedor', 'Parceiro', 'Outro'];
const FEEDBACK_EMPTY = { name: '', company: '', role: 'Comprador', rating: '5', message: '', consent: false, website: '' };

// "Avaliações" — a parede mostra o que já foi aprovado pelo Admin do Sistema;
// o formulário submete para moderação (nunca aparece antes de aprovado). O
// campo "website" é o honeypot: invisível para uma pessoa, devolvido como
// sucesso mas nunca guardado se um robô o preencher.
function FeedbackSection({ t }) {
  const [wall, setWall] = useState(null);
  const [form, setForm] = useState(FEEDBACK_EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    api.get('/api/public/feedback').then(setWall).catch(() => {});
  }, []);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.post('/api/public/feedback', { ...form, rating: Number(form.rating) });
      setDone(true);
      setForm(FEEDBACK_EMPTY);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return <section className="section feedback" id="avaliacoes"><div className="section-heading"><p className="eyebrow">{t('AVALIAÇÕES')}</p><h2>{t('Feedback real, não decorativo.')}</h2><p>{t('Compradores, fornecedores e parceiros avaliam a experiência na KIXIMA. Cada avaliação é revista antes de ser publicada e a média mostrada conta sempre todas as aprovadas.')}</p></div>
    <div className="feedback-grid">
      <div className="feedback-wall">
        {wall && wall.total > 0
          ? <p className="feedback-average"><strong>{wall.average.toFixed(1).replace('.', ',')}</strong> / 5 · {t('{total} avaliações aprovadas', { total: wall.total })}</p>
          : null}
        {wall && wall.feedback.length > 0
          ? wall.feedback.map((f) => (
            <article className="feedback-card" key={f.id}>
              <div className="feedback-stars" aria-label={t('{rating} de 5', { rating: f.rating })} aria-hidden="true">{'★'.repeat(f.rating)}{'☆'.repeat(5 - f.rating)}</div>
              <p>{f.message}</p>
              <footer><strong>{f.name}</strong><span>{f.company} · {t(f.role)}</span></footer>
            </article>
          ))
          : <p className="feedback-empty">{t('Ainda não há avaliações públicas. Seja o primeiro a partilhar a sua experiência.')}</p>}
      </div>
      <form className="feedback-form" onSubmit={handleSubmit}>
        {done ? <p className="feedback-done">{t('Obrigado! A sua avaliação foi recebida e será publicada depois de revista.')}</p> : <>
          <div className="feedback-row">
            <label>{t('Nome')}<input required value={form.name} maxLength={80} onChange={(e) => update('name', e.target.value)} /></label>
            <label>{t('Empresa')}<input required value={form.company} maxLength={120} onChange={(e) => update('company', e.target.value)} /></label>
          </div>
          <div className="feedback-row">
            <label>{t('Perfil')}<select value={form.role} onChange={(e) => update('role', e.target.value)}>{FEEDBACK_ROLES.map((r) => <option key={r} value={r}>{t(r)}</option>)}</select></label>
            <label>{t('Classificação')}<select value={form.rating} onChange={(e) => update('rating', e.target.value)}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} / 5</option>)}</select></label>
          </div>
          <label>{t('A sua experiência')}<textarea required rows={4} maxLength={700} value={form.message} onChange={(e) => update('message', e.target.value)} /></label>
          <input type="text" name="website" tabIndex={-1} autoComplete="off" className="feedback-honeypot" aria-hidden="true" value={form.website} onChange={(e) => update('website', e.target.value)} />
          <label className="feedback-consent"><input type="checkbox" checked={form.consent} onChange={(e) => update('consent', e.target.checked)} /> {t('Autorizo a KIXIMA a analisar e, se aprovado, publicar este feedback.')}</label>
          {error ? <p className="feedback-error">{error}</p> : null}
          <button className="button button-dark" type="submit" disabled={submitting}>{submitting ? t('A enviar…') : t('Enviar avaliação')}</button>
        </>}
      </form>
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

    <section className="section demo" id="demonstracao"><div className="section-heading centered"><p className="eyebrow">{t('DEMONSTRAÇÃO')}</p><h2>{t('Veja a KIXIMA a funcionar, do login ao checkout.')}</h2><p>{t('Gravação real da plataforma, numa conta de demonstração - sem dados forjados: o mesmo catálogo, carrinho, impostos e checkout por fornecedor que os clientes usam todos os dias.')}</p></div>
      <div className="demo-frame"><video controls preload="none" poster="/videos/kixima-login-checkout-poster.jpg" aria-label={t('Demonstração da plataforma KIXIMA, do login ao checkout')}><source src="/videos/kixima-login-checkout.mp4" type="video/mp4" /><track kind="captions" src="/videos/kixima-login-checkout.vtt" srcLang="pt" label={t('Português')} default /></video></div>
      <ol className="demo-journey"><li>{t('Login seguro')}</li><li>{t('Painel do comprador')}</li><li>{t('Catálogo e pesquisa')}</li><li>{t('Ficha de produto')}</li><li>{t('Carrinho e impostos')}</li><li>{t('Checkout por fornecedor')}</li></ol>
      <p className="demo-note">{t('Conta de demonstração. O IVA de 14% e o agrupamento por fornecedor são calculados exactamente como em produção.')}</p>
    </section>

    <section className="human-network" aria-label={t('A rede KIXIMA é feita por pessoas')}><div className="human-photo"><img src={kiximaHumanNetwork} alt={t('Compradora e fornecedor angolanos a analisar uma oportunidade de negócio')} loading="lazy" /></div><div className="human-copy"><p className="eyebrow">{t('NEGÓCIOS ENTRE PESSOAS')}</p><h2>{t('Tecnologia que aproxima')} <em>{t('capacidade e oportunidade.')}</em></h2><p>{t('Por detrás de cada catálogo, ordem de compra e entrega estão empresas que querem crescer e profissionais que precisam de comprar com confiança. A KIXIMA existe para tornar essa relação mais simples, visível e segura.')}</p><div className="human-groups"><span><i></i> {t('Compradores')}</span><span><i></i> {t('Fornecedores')}</span><span><i></i> {t('Parceiros')}</span></div></div></section>

    <section className="section two-doors" id="marketplace"><div className="section-heading"><p className="eyebrow">{t('UM ECOSSISTEMA. DUAS PORTAS.')}</p><h2>{t('Entre para comprar.')}<br />{t('Entre para crescer.')}</h2><p>{t('A KIXIMA.NET reduz a distância entre quem precisa de comprar e quem está preparado para fornecer.')}</p></div><div className="door-grid">
      <article className="door buyer" id="compradores"><span className="door-number">01</span><div className="door-icon" aria-hidden="true">⌕</div><p className="eyebrow">{t('PARA COMPRADORES')}</p><h3>{t('Encontre capacidade. Compre com confiança.')}</h3><p>{t('Descubra novos fornecedores, compare ofertas e transforme necessidades em ordens de compra rastreáveis.')}</p><ul><li>{t('Catálogo classificado por UNSPSC')}</li><li>{t('Fornecedores credenciados')}</li><li>{t('Processo transparente e auditável')}</li></ul><Link to="/cadastro?tipo=CLIENTE">{t('Registar como comprador')} <Arrow /></Link></article>
      <article className="door supplier" id="fornecedores"><span className="door-number">02</span><div className="door-icon" aria-hidden="true">◇</div><p className="eyebrow">{t('PARA FORNECEDORES')}</p><h3>{t('Ganhe visibilidade. Aceda ao mercado.')}</h3><p>{t('Apresente o seu catálogo, responda a oportunidades e receba com maior previsibilidade.')}</p><ul><li>{t('Catálogo digital sem fronteiras')}</li><li>{t('Pedidos e POs organizados')}</li><li>{t('Programas de desenvolvimento')}</li></ul><Link to="/cadastro?tipo=FORNECEDOR">{t('Registar como fornecedor')} <Arrow /></Link></article>
    </div></section>

    <section className="section story" id="sobre"><div className="story-visual" aria-hidden="true"><div className="story-mark"><img src={kiximaMarkReversed} alt="" /></div><div className="story-quote">{t('“Por que razão uma pequena empresa do Cazenga não pode fornecer a uma grande operadora?”')}</div><div className="story-diamonds"><i></i><i></i><i></i><i></i></div></div><div className="story-copy" id="historia"><p className="eyebrow">{t('A NOSSA ORIGEM')}</p><h2>{t('Uma inquietação transformada em infraestrutura.')}</h2><p>{t('A KIXIMA nasceu de uma realidade observada durante mais de 20 anos de procurement: compradores concentrados nos mesmos fornecedores e empresas locais capazes sem acesso ao mercado.')}</p><p>{t('Construímos a ponte. Levamos fornecedores qualificados até aos compradores e damos às empresas locais a visibilidade, a capacitação e a confiança necessárias para competir.')}</p><a className="text-link" href="#impacto">{t('Conheça o nosso impacto')} <Arrow /></a></div></section>

    <section className="section process" id="como-funciona"><div className="section-heading centered"><p className="eyebrow">{t('COMO FUNCIONA')}</p><h2>{t('Da necessidade ao pagamento.')}</h2><p>{t('Uma jornada simples para processos complexos.')}</p></div><ol className="process-grid"><li><span>01</span><div className="process-diamond"></div><h3>{t('Credenciamento')}</h3><p>{t('A empresa submete os seus dados e documentos para verificação.')}</p></li><li><span>02</span><div className="process-diamond"></div><h3>{t('Mercado')}</h3><p>{t('Compradores pesquisam e fornecedores apresentam catálogos e propostas.')}</p></li><li><span>03</span><div className="process-diamond"></div><h3>{t('Execução')}</h3><p>{t('O pedido transforma-se em PO, entrega e confirmação de recepção.')}</p></li><li><span>04</span><div className="process-diamond"></div><h3>{t('Pagamento')}</h3><p>{t('A KIXIMA garante rastreabilidade e pagamento ao fornecedor em até 7 dias.')}</p></li></ol><div className="process-action"><Link className="button button-dark" to="/cadastro">{t('Começar agora')} <Arrow /></Link></div></section>

    <section className="programs" id="impacto"><div className="programs-inner"><div className="programs-heading"><p className="eyebrow">{t('MAIS DO QUE UM MARKETPLACE')}</p><h2>{t('Capacidade local. Parcerias globais.')}</h2></div><div className="program-cards"><article><span>SD</span><p className="eyebrow">{t('SUPPLIER DEVELOPMENT')}</p><h3>{t('Prepare a sua empresa para fornecer.')}</h3><p>{t('Apoio no processo de credenciamento, organização documental e desenvolvimento da capacidade empresarial.')}</p><Link to="/supplier-development">{t('Conhecer o programa')} <Arrow /></Link></article><article><span>↔</span><p className="eyebrow">{t('PARCEIROS INTERNACIONAIS')}</p><h3>{t('Ligue capacidade local a tecnologia global.')}</h3><p>{t('Facilitamos relações com parceiros estrangeiros para tecnologia, especialização, capacitação e crescimento conjunto.')}</p><Link to="/parcerias">{t('Encontrar parceiros')} <Arrow /></Link></article></div></div></section>

    <section className="section sectors" id="sectores"><div className="section-heading"><p className="eyebrow">{t('UMA REDE MULTISSECTORIAL')}</p><h2>{t('Nascida no Oil & Gas.')}<br />{t('Preparada para toda a economia.')}</h2><p>{t('A mesma disciplina de credenciamento, conformidade e execução pode ligar empresas em diferentes cadeias de valor, sem tornar a plataforma dependente de um único sector.')}</p></div><div className="sector-visuals"><figure><img src={kiximaEnergyMining} alt={t('Profissionais angolanos nos sectores de energia, Oil & Gas, indústria e mineração')} loading="lazy" /><figcaption><span>{t('OPERAÇÕES DE ALTA EXIGÊNCIA')}</span><b>{t('Energia · Oil & Gas · Indústria · Mineração')}</b></figcaption></figure><figure><img src={kiximaLogisticsAgri} alt={t('Profissionais angolanos nos sectores de logística, aviação, indústria e agricultura')} loading="lazy" /><figcaption><span>{t('CADEIAS DE VALOR EM CRESCIMENTO')}</span><b>{t('Logística · Aviação · Agricultura · Bens e serviços')}</b></figcaption></figure></div><div className="sector-grid"><article><span>01</span><h3>{t('Oil & Gas')}</h3><p>{t('O ponto de partida e a referência de exigência operacional.')}</p></article><article><span>02</span><h3>{t('Energia')}</h3><p>{t('Equipamentos, serviços técnicos e suporte às operações.')}</p></article><article><span>03</span><h3>{t('Indústria')}</h3><p>{t('Capacidade produtiva, manutenção e fornecimento especializado.')}</p></article><article><span>04</span><h3>{t('Mineração')}</h3><p>{t('Bens, serviços e parceiros para operações extractivas.')}</p></article><article><span>05</span><h3>{t('Logística e aviação')}</h3><p>{t('Mobilidade, carga, armazenagem e serviços aeroportuários.')}</p></article><article><span>06</span><h3>{t('Agricultura e outros')}</h3><p>{t('Uma infraestrutura preparada para novos mercados.')}</p></article></div></section>

    <section className="section trust" id="confianca"><div className="trust-copy"><p className="eyebrow">{t('CONFIANÇA KIXIMA')}</p><h2>{t('Verificação que cria valor para os dois lados.')}</h2><p>{t('O nosso modelo foi concebido para reduzir risco, aumentar transparência e fortalecer a confiança entre empresas que ainda não fizeram negócios entre si.')}</p><Link className="text-link" to="/termos">{t('Conheça as regras da plataforma')} <Arrow /></Link></div><div className="trust-seal"><div className="seal-ring"><img src={kiximaMark} alt="" /><strong>{t('FORNECEDOR')}<br />{t('VERIFICADO')}</strong></div><div className="trust-list"><span><b>✓</b> {t('Documentação validada')}</span><span><b>✓</b> {t('Identidade empresarial confirmada')}</span><span><b>✓</b> {t('Histórico e processo auditáveis')}</span></div></div></section>

    <FeedbackSection t={t} />

    <section className="final-cta"><div className="final-pattern" aria-hidden="true"></div><div><p className="eyebrow">{t('A SUA PRÓXIMA OPORTUNIDADE PODE COMEÇAR AQUI')}</p><h2>{t('Faça parte da fonte.')}</h2><p>{t('Registe a sua empresa e entre num novo ecossistema de procurement africano.')}</p></div><Link className="button button-light" to="/cadastro">{t('Registar empresa')} <Arrow /></Link></section>

    <CorporateFooter isHome />
  </main>;
}
