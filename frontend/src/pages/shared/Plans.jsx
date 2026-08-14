// src/pages/shared/Plans.jsx
// Planos e preços — página PÚBLICA (login e home). Explica o modelo comercial:
// taxa por transação (por PO e por fatura, com limiar) e taxa de acesso por
// utilizador; e o que distingue os três planos (Entrada, Core e Pro).
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../../components/Logo';
import { Icon } from '../../components/icons';
import { useI18n, LANGS } from '../../i18n';

// Os três planos. Tem de espelhar backend/src/services/planService.js — se
// divergirem, a página promete uma coisa e a plataforma faz outra, e quem
// descobre é o cliente que pagou.
//
// O QUE NÃO ESTÁ NESTA TABELA, de propósito: um limite de itens no catálogo.
// Não existe em plano nenhum. A densidade do catálogo é o que faz o marketplace
// valer para o comprador, e limitá-la cortaria a Taxa KIXIMA — que é a receita
// maior — para proteger a taxa de acesso, que é a menor.
const PLANS = [
  {
    key: 'ENTRADA',
    name: 'Entrada',
    price: 'Sob consulta',
    unit: 'para começar a vender',
    forWho: 'Micro e pequenas empresas a entrar na cadeia de fornecimento',
    features: [
      'Catálogo sem limite de itens',
      'Marketplace completo: catálogo, cesta, ordens de compra e faturas',
      'Pagamento garantido com comprovativo e confirmação de receção',
      '2 utilizadores incluídos',
      '3 pedidos de cotação por mês',
      '3 imagens e 1 documento técnico por item',
      'Histórico de relatórios de 3 meses',
    ],
  },
  {
    key: 'CORE',
    name: 'Core',
    price: 'Sob consulta',
    unit: 'para quem já vende com regularidade',
    forWho: 'Pequenas e médias empresas com catálogo ativo',
    features: [
      'Tudo o que o plano Entrada inclui',
      '5 utilizadores incluídos',
      'Kits e pacotes de produtos',
      '20 pedidos de cotação por mês',
      '10 imagens e 3 documentos técnicos por item',
      'Histórico de relatórios de 12 meses',
    ],
  },
  {
    key: 'PRO',
    name: 'Pro',
    price: 'Sob consulta',
    unit: 'obrigatório para grandes empresas',
    forWho: 'Grandes empresas (mais de 200 trabalhadores ou 10 M USD)',
    highlight: true,
    features: [
      'Tudo o que o plano Core inclui',
      'Utilizadores sem limite',
      'Carregamento de catálogo em massa por Excel',
      'Integração com ERPs: SAP, AS400, SAP Ariba, IBM Maximo, Oracle e outros',
      'Contratos-quadro com call-offs automáticos e faturação consolidada',
      'Relatório de conteúdo local: contratação nacional, origem dos bens e compras a MPME angolanas',
      'Pedidos de cotação e histórico de relatórios sem limite',
      '6 documentos técnicos por item',
      'Acompanhamento dedicado da equipa KIXIMA',
    ],
  },
];

export default function Plans() {
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();

  return (
    <div className="sd-page">
      <header className="sd-top">
        <Link to="/login" className="sd-brand"><Logo size={20} mark={44} subtitle /></Link>
        <div className="sd-top-actions">
          <select className="input sd-lang" value={lang} onChange={(e) => setLang(e.target.value)} aria-label={t('Idioma')}>
            {LANGS.map((l) => <option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/login')}>{t('Entrar')}</button>
        </div>
      </header>

      <section className="sd-hero">
        <span className="sd-tag">{t('Planos KIXIMA')}</span>
        <h1>{t('Preços simples, ligados ao negócio real')}</h1>
        <p>{t('Paga-se pelo que se transaciona e pelo acesso de cada utilizador. Sem custos escondidos.')}</p>
      </section>

      {/* Taxas por transação — comuns aos dois planos. */}
      <section className="sd-formwrap" style={{ maxWidth: 900 }}>
        <div className="sd-card">
          <h2>{t('Taxa por transação (Taxa KIXIMA)')}</h2>
          <p className="helptext">{t('Cobrada ao fornecedor em cada pagamento processado, à parte da ordem de compra e da fatura.')}</p>
          <div className="pl-fees">
            <div className="pl-fee">
              <strong>8 USD</strong>
              <span>{t('por ordem de compra, até 11.500 USD por transação')}</span>
            </div>
            <div className="pl-fee">
              <strong>0,20%</strong>
              <span>{t('do valor da transação, acima de 11.500 USD — cobrado no fim, inclui a PO e a fatura')}</span>
            </div>
            <div className="pl-fee">
              <strong>15 USD</strong>
              <span>{t('por fatura emitida')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Planos de acesso. */}
      <section className="sd-formwrap" style={{ maxWidth: 900 }}>
        <div className="pl-grid">
          {PLANS.map((p) => (
            <article className={`pl-card${p.highlight ? ' pl-card-pro' : ''}`} key={p.key}>
              {p.highlight ? <span className="pl-badge">{t('Grandes empresas')}</span> : null}
              <h2>{t(p.name)}</h2>
              <div className="pl-price"><strong>{t(p.price)}</strong><span>{t(p.unit)}</span></div>
              <p className="pl-for">{t(p.forWho)}</p>
              <ul className="pl-list">
                {p.features.map((f) => (
                  <li key={f}><Icon name="reception" size={14} /> <span>{t(f)}</span></li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <p className="helptext" style={{ textAlign: 'center', marginTop: 16 }}>
          {t('A dimensão da empresa segue o critério das micro, pequenas e médias empresas e é confirmada pela KIXIMA no credenciamento.')}
        </p>

        {/* Programas: a taxa de acesso é cobrada no acto da candidatura. */}
        <div className="sd-fee" style={{ marginTop: 18 }}>
          <div className="sd-fee-head">
            <span className="sd-fee-ico"><Icon name="wallet" size={18} /></span>
            <div>
              <strong>{t('Supplier Development e Parceiros internacionais')}</strong>
              <span className="sd-fee-amount">{t('100 USD/mês')}</span>
            </div>
          </div>
          <p>{t('A taxa de acesso aos programas é a mesma das pequenas empresas e é cobrada logo na submissão da intenção de candidatura.')}</p>
          <p>{t('O restante do programa (os serviços efetivamente prestados) é orçamentado caso a caso, depois da triagem da sua candidatura.')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14, flexWrap: 'wrap' }}>
          <Link className="btn btn-accent" to="/cadastro">{t('Registar a minha empresa')}</Link>
          <Link className="btn btn-ghost" to="/supplier-development">{t('Supplier Development')}</Link>
          <Link className="btn btn-ghost" to="/parcerias">{t('Parceiros internacionais')}</Link>
        </div>
      </section>

      <footer className="sd-foot">
        <Link to="/termos">{t('Termos de Uso')}</Link> · <Link to="/privacidade">{t('Política de Privacidade')}</Link>
      </footer>
    </div>
  );
}
