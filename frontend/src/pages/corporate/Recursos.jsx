// src/pages/corporate/Recursos.jsx
// Página pública de guias para fornecedores — destino real dos itens
// "Guias para fornecedores" / "Guias e recursos" do menu/rodapé corporativo
// (antes uma âncora sem conteúdo). Conteúdo derivado do que já é descrito
// na home (credenciamento, catálogo UNSPSC, POs, Supplier Development).
import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { Arrow, CorporateHeader, CorporateFooter, useCorporateActive } from './CorporateChrome';
import './corporate.css';

export default function Recursos() {
  const { t } = useI18n();
  useCorporateActive();

  return <main className="kixima-corp">
    <CorporateHeader />

    <section className="page-hero"><p className="eyebrow">{t('RECURSOS')}</p><h1>{t('Guias e recursos')}</h1><p>{t('Informação prática para preparar a sua empresa e tirar o máximo partido da KIXIMA.NET.')}</p></section>

    <section className="section" style={{ paddingTop: 30 }}>
      <div className="guide-grid">
        <div className="guide-card"><span>01</span><h3>{t('Prepare a sua candidatura')}</h3><p>{t('Reúna os dados e documentos de identificação da sua empresa para o processo de credenciamento e verificação.')}</p><Link to="/cadastro?tipo=FORNECEDOR">{t('Registar como fornecedor')} <Arrow /></Link></div>
        <div className="guide-card"><span>02</span><h3>{t('Organize o seu catálogo')}</h3><p>{t('Classifique os seus produtos e serviços para que sejam facilmente encontrados por compradores no marketplace.')}</p></div>
        <div className="guide-card"><span>03</span><h3>{t('Responda a pedidos com confiança')}</h3><p>{t('Acompanhe pedidos, cotações e ordens de compra num único lugar, do pedido à entrega e ao pagamento.')}</p></div>
        <div className="guide-card"><span>04</span><h3>{t('Cresça com o Supplier Development')}</h3><p>{t('Apoio no processo de credenciamento, organização documental e desenvolvimento da capacidade empresarial.')}</p><Link to="/supplier-development">{t('Conhecer o programa')} <Arrow /></Link></div>
      </div>
      <div className="cta-inline" style={{ marginTop: 44 }}>
        <Link className="button button-primary" to="/cadastro?tipo=FORNECEDOR">{t('Registar como fornecedor')} <Arrow /></Link>
        <Link className="text-link" to="/faq">{t('Perguntas frequentes')} <Arrow /></Link>
      </div>
    </section>

    <CorporateFooter />
  </main>;
}
