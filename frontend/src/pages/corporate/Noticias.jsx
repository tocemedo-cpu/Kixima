// src/pages/corporate/Noticias.jsx
// Página pública de notícias e perspectivas — destino real do item
// "Notícias e perspectivas" do menu/rodapé corporativo (antes uma âncora
// sem conteúdo). Sem sistema de blog/imprensa, o conteúdo é honesto quanto
// a isso: apresenta a perspectiva da KIXIMA e um contacto real de imprensa,
// em vez de inventar artigos ou datas.
import { useI18n } from '../../i18n';
import { CorporateHeader, CorporateFooter, useCorporateActive } from './CorporateChrome';
import './corporate.css';

export default function Noticias() {
  const { t } = useI18n();
  useCorporateActive();

  return <main className="kixima-corp">
    <CorporateHeader />

    <section className="page-hero"><p className="eyebrow">{t('PERSPECTIVAS')}</p><h1>{t('Notícias e perspectivas')}</h1><p>{t('Acompanhe a evolução da KIXIMA.NET e a nossa visão sobre procurement, capacidade local e mercado africano.')}</p></section>

    <section className="section" style={{ paddingTop: 30 }}>
      <div className="prose">
        <p><strong>{t('Uma inquietação transformada em infraestrutura.')}</strong> {t('A KIXIMA nasceu de uma realidade observada durante mais de 20 anos de procurement: compradores concentrados nos mesmos fornecedores e empresas locais capazes sem acesso ao mercado. Construímos a ponte entre os dois lados, com verificação, transparência e rastreabilidade em cada etapa.')}</p>
        <p>{t('Estamos a construir este espaço de notícias e perspectivas. Para novidades imediatas sobre a plataforma ou pedidos de imprensa, contacte-nos diretamente.')}</p>
      </div>
      <div className="cta-inline" style={{ marginTop: 30 }}>
        <a className="button button-primary" href="mailto:geral@kixima.net?subject=Imprensa">{t('Contactar a Kixima')}</a>
      </div>
    </section>

    <CorporateFooter />
  </main>;
}
