// src/pages/corporate/ComingSoon.jsx
// Página de lançamento de kixima.net — "Estamos a chegar… Brevemente!".
// Mostrada na raiz "/" a quem não tem sessão enquanto public/launch.json tiver
// { "enabled": true } (ver src/launch/launch.js e LANCAMENTO.md). Também vive
// sempre em /em-breve, para a poder rever com o interruptor desligado.
//
// Composição da imagem de lançamento aprovada, com a identidade oficial: o
// símbolo e o nome KIXIMA.NET do site corporativo, Sora/Inter, o fundo
// "Escuro 2" (casco azul-noite + âmbar) e o fio Samakaka no topo. Cores FIXAS
// (não seguem o fundo escolhido pela pessoa): é um cartaz, tem de ser sempre
// igual. Não depende da API nem da sessão.
import { useEffect } from 'react';
import { useI18n } from '../../i18n';
import './coming-soon.css';
import kiximaMarkReversed from '../../assets/brand/kixima-mark-reversed.png';

export default function ComingSoon() {
  const { t } = useI18n();

  useEffect(() => {
    const anterior = document.title;
    document.title = `KIXIMA.NET | ${t('Brevemente')}`;
    return () => { document.title = anterior; };
  }, [t]);

  return (
    <main className="soon" id="top">
      <div className="soon-strip" aria-hidden="true" />
      <div className="soon-in">
        <header>
          <div className="soon-lock">
            <img src={kiximaMarkReversed} alt="" />
            <span className="soon-wm">KIXIMA<i>.NET</i></span>
          </div>
          <p className="soon-tag">{t('O maior ecossistema africano de catálogos digitais')}</p>
          <div className="soon-rule" aria-hidden="true" />
        </header>
        <h1 className="soon-h1">
          {t('Estamos a chegar…')}{' '}
          <span>{t('Brevemente!')}</span>
        </h1>
      </div>
      <footer className="soon-foot">
        <p>{t('Procurement digital · Oil & Gas · África')}</p>
        <p className="soon-url">kixima.net</p>
      </footer>
    </main>
  );
}
