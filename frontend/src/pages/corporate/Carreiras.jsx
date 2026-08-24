// src/pages/corporate/Carreiras.jsx
// Página pública de carreiras — destino real do item "Carreiras" do
// menu/rodapé corporativo (antes uma âncora sem conteúdo). Sem sistema de
// vagas, o conteúdo é honesto quanto a isso e convida a candidaturas
// espontâneas por email, em vez de inventar vagas que não existem.
import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { Arrow, CorporateHeader, CorporateFooter, useCorporateActive } from './CorporateChrome';
import './corporate.css';

export default function Carreiras() {
  const { t } = useI18n();
  useCorporateActive();

  return <main className="kixima-corp">
    <CorporateHeader />

    <section className="page-hero"><p className="eyebrow">{t('CARREIRAS')}</p><h1>{t('Construa connosco a ponte entre capacidade local e oportunidade.')}</h1></section>

    <section className="section" style={{ paddingTop: 30 }}>
      <div className="prose">
        <p>{t('A KIXIMA nasceu de uma realidade observada durante mais de 20 anos de procurement: compradores concentrados nos mesmos fornecedores e empresas locais capazes sem acesso ao mercado. Trabalhar na KIXIMA é ajudar a construir a infraestrutura que resolve isso.')}</p>
        <p>{t('Não temos vagas publicadas neste momento. Se quer fazer parte da equipa que está a construir esta ponte, envie-nos uma candidatura espontânea com o seu percurso e a área em que gostaria de contribuir.')}</p>
      </div>
      <div className="cta-inline" style={{ marginTop: 30 }}>
        <a className="button button-primary" href="mailto:geral@kixima.net?subject=Candidatura%20espont%C3%A2nea">{t('Enviar candidatura')} <Arrow /></a>
        <Link className="text-link" to="/faq">{t('Perguntas frequentes')} <Arrow /></Link>
      </div>
    </section>

    <CorporateFooter />
  </main>;
}
