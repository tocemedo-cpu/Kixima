// Fundo escolhido (Claro / Escuro 1 / Escuro 2) aplicado antes do primeiro paint, para não haver um clarão do
// fundo errado; sem escolha guardada o CSS segue o sistema (prefers-color-scheme). Ver src/tema/TemaContext.jsx.
//
// É um FICHEIRO (e não um <script> inline no index.html) porque a CSP do servidor é `script-src 'self'`:
// um script inline é recusado pelo navegador, e o erro aparecia na consola de todas as páginas.
try {
  var t = localStorage.getItem('kixima.tema');
  if (t === 'claro' || t === 'escuro-1' || t === 'escuro-2') document.documentElement.setAttribute('data-tema', t);
} catch (e) { /* sem armazenamento: segue o sistema */ }
