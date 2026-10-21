// src/launch/launch-page.js
// Script da página de lançamento estática (launch.html): carrega o tipo de letra e o
// estilo do mesmo ecrã React e traduz os textos para a língua escolhida na aplicação
// (kixima_lang em localStorage; sem escolha, português).
// Sem React, sem API, sem sessão — funciona sozinha, e é só isto que o servidor serve
// enquanto o modo de lançamento está ligado.
import '@fontsource-variable/sora';
import '@fontsource-variable/inter';
import '../styles/tema.css';
import '../pages/corporate/coming-soon.css';
import { EN18, FR18 } from '../i18n/content17';

const DICT = { en: EN18, fr: FR18 };

function lingua() {
  let guardada = null;
  try { guardada = localStorage.getItem('kixima_lang'); } catch { /* modo privado */ }
  // Como a aplicação (src/i18n/index.jsx): a língua escolhida, senão português — a do
  // browser não conta, para a página aparecer sempre como na imagem de lançamento.
  return guardada === 'en' || guardada === 'fr' ? guardada : 'pt';
}

const l = lingua();
document.documentElement.lang = l === 'pt' ? 'pt-AO' : l;
const d = DICT[l];
if (d) {
  document.querySelectorAll('[data-t]').forEach((el) => {
    const t = d[el.dataset.t];
    if (t) el.textContent = t;
  });
  document.title = `KIXIMA.NET | ${d.Brevemente || 'Brevemente'}`;
}
