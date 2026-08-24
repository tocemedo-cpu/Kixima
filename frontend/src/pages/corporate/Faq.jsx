// src/pages/corporate/Faq.jsx
// Página pública de perguntas frequentes — destino real do item "Perguntas
// frequentes" do menu/rodapé corporativo (antes uma âncora sem conteúdo,
// ver CorporateChrome.jsx). Respostas derivadas do que a plataforma já
// afirma nas outras páginas públicas (home, planos, termos) — nunca uma
// política ou prazo inventado aqui.
import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { CorporateHeader, CorporateFooter, useCorporateActive } from './CorporateChrome';
import './corporate.css';

function Item({ q, children }) {
  return <details><summary>{q}</summary><div className="faq-answer">{children}</div></details>;
}

export default function Faq() {
  const { t } = useI18n();
  useCorporateActive();

  return <main className="kixima-corp">
    <CorporateHeader />

    <section className="page-hero"><p className="eyebrow">{t('AJUDA')}</p><h1>{t('Perguntas frequentes')}</h1><p>{t('Respostas rápidas às dúvidas mais comuns sobre como funciona a KIXIMA.NET.')}</p></section>

    <section className="section" style={{ paddingTop: 30 }}>
      <div className="faq-list">
        <Item q={t('Como registo a minha empresa na KIXIMA?')}>
          {t('Submeta os dados e documentos da sua empresa através do registo. A nossa equipa realiza um processo de credenciamento e verificação antes da aprovação.')} <Link to="/cadastro">{t('Iniciar registo')}</Link>
        </Item>
        <Item q={t('Qual a diferença entre registar como comprador ou como fornecedor?')}>
          {t('Como comprador, tem acesso a um catálogo de fornecedores credenciados e pode transformar necessidades em ordens de compra rastreáveis. Como fornecedor, apresenta o seu catálogo, responde a pedidos e recebe ordens de compra organizadas.')}
        </Item>
        <Item q={t('Como funciona o pagamento aos fornecedores?')}>
          {t('A KIXIMA garante rastreabilidade em todo o processo, desde o pedido até à entrega e recepção, com pagamento processado num prazo definido e comunicado na plataforma.')}
        </Item>
        <Item q={t('Preciso de pagar para registar a minha empresa?')}>
          {t('Consulte os nossos')} <Link to="/planos">{t('planos e preços')}</Link> {t('para conhecer as condições disponíveis para compradores e fornecedores.')}
        </Item>
        <Item q={t('O que é o Supplier Development?')}>
          {t('É o programa da KIXIMA para apoiar empresas locais no processo de credenciamento, organização documental e desenvolvimento de capacidade para fornecer.')} <Link to="/supplier-development">{t('Conhecer o programa')}</Link>
        </Item>
        <Item q={t('Como posso obter apoio depois de me registar?')}>
          {t('Depois de aceder à sua conta, encontra o centro de ajuda e o chat de suporte na plataforma. Também pode contactar-nos diretamente por email.')} <a href="mailto:geral@kixima.net">geral@kixima.net</a>
        </Item>
        <Item q={t('Onde encontro as regras e a política de privacidade da plataforma?')}>
          <Link to="/termos">{t('Termos de uso')}</Link> {t('e')} <Link to="/privacidade">{t('Política de privacidade')}</Link>.
        </Item>
      </div>
    </section>

    <CorporateFooter />
  </main>;
}
