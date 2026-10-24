// src/middleware/frontend.js
// Serve o frontend compilado (SPA) na mesma origem que a API — o deploy de serviço
// único — e aplica o MODO DE LANÇAMENTO no servidor.
//
// MODO DE LANÇAMENTO. Enquanto <frontend/dist>/launch.json (origem: frontend/public/
// launch.json) tiver { "enabled": true }, QUALQUER pedido de página devolve
// launch.html — a página "Estamos a chegar… Brevemente!" estática, sem React — em vez
// da aplicação: "/", "/index.html", "/login", "/cadastro", dashboards, páginas
// administrativas, rotas desconhecidas. Não há rota que contorne isto, porque a decisão
// é tomada aqui, antes do express.static (que serviria o index.html em "/") e no
// fallback de SPA. Com "enabled": false (ou sem o ficheiro) nada disto actua e o
// comportamento é exactamente o de antes.
//
// O QUE NUNCA É TOCADO: a API (/api), as sondas (/health, /ready), o /socket.io e
// tudo o que o app.js registou ANTES de chamar montarFrontend (webhooks, etc.) — esta
// função só regista middleware no fim da cadeia. Ficheiros com extensão (assets, imagens,
// o próprio launch.json) são servidos como sempre: são ficheiros, não páginas. Só
// GET/HEAD; qualquer outro método segue o caminho de sempre.
//
// O interruptor é relido quando o ficheiro muda (mtime + tamanho), sem reiniciar.
// Falha para o site de sempre: sem ficheiro, JSON inválido ou valor que não seja
// exactamente `true` → desligado. Ligado mas sem launch.html no dist → avisa uma vez e
// segue com a app (a guarda do próprio SPA mostra então a página de lançamento).
const fs = require('fs');
const path = require('path');

// Prefixos que nunca são "página" (comparação sem maiúsculas, como o router do Express).
const RESERVADOS = ['/api', '/socket.io', '/health', '/ready'];

function eReservado(caminho) {
  const c = caminho.toLowerCase();
  return RESERVADOS.some((r) => c === r || c.startsWith(`${r}/`));
}

// "Página" = o que o browser abre ao navegar: sem extensão (/, /login, /sistema/auditoria)
// ou .html (/index.html). Ficheiros com outra extensão são recursos estáticos.
function ePaginaDeNavegacao(req, ignorarExtensao = false) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  const caminho = req.path || '/';
  if (eReservado(caminho)) return false;
  if (ignorarExtensao) return true;
  const ultimo = caminho.split('/').pop();
  const m = /\.([A-Za-z0-9]{1,10})$/.exec(ultimo);
  return !m || /^html?$/i.test(m[1]);
}

function criarLancamento(distDir, { aviso = (m) => console.warn(m) } = {}) {
  const jsonFile = path.join(distDir, 'launch.json');
  const pagina = path.join(distDir, 'launch.html');
  let cache = { chave: null, ligado: false };
  let avisou = false;

  function ligado() {
    let st;
    try { st = fs.statSync(jsonFile); } catch { cache = { chave: null, ligado: false }; return false; }
    const chave = `${st.mtimeMs}:${st.size}`;
    if (chave !== cache.chave) {
      let on = false;
      try { on = JSON.parse(fs.readFileSync(jsonFile, 'utf8')).enabled === true; } catch { on = false; }
      cache = { chave, ligado: on };
    }
    return cache.ligado;
  }

  // Devolve true se respondeu com a página de lançamento.
  // `ignorarExtensao`: no fallback de SPA (pedidos que nenhum ficheiro satisfez) tudo o
  // que não é reservado é tratado como página.
  function servir(req, res, ignorarExtensao = false) {
    if (!ePaginaDeNavegacao(req, ignorarExtensao) || !ligado()) return false;
    if (!fs.existsSync(pagina)) {
      if (!avisou) { avisou = true; aviso('[kixima] Modo de lançamento LIGADO mas falta launch.html no frontend/dist — a servir a app (a página de lançamento aparece pela guarda do SPA).'); }
      return false;
    }
    res.status(200);
    res.sendFile(pagina, { cacheControl: false, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } }, (err) => {
      if (err && !res.headersSent) res.status(500).end();
    });
    return true;
  }

  return { ligado, servir };
}

// Regista, no fim da cadeia do Express: a página de lançamento (se ligada), os ficheiros
// estáticos e o fallback de SPA. `express` vem de quem chama (o app.js já o tem).
function montarFrontend(app, express, frontendDist, opcoes = {}) {
  const lancamento = criarLancamento(frontendDist, opcoes);
  app.use((req, res, next) => (lancamento.servir(req, res) ? undefined : next()));
  app.use(express.static(frontendDist));
  app.get(/^(?!\/api\/).*/, (req, res, next) => {
    if (req.method !== 'GET') return next();
    // Ficheiro inexistente com extensão (ex.: /assets/velho.js) cai aqui: no modo de
    // lançamento também não recebe a app.
    if (lancamento.servir(req, res, true)) return undefined;
    return res.sendFile(path.join(frontendDist, 'index.html'));
  });
  return lancamento;
}

module.exports = { montarFrontend, criarLancamento, ePaginaDeNavegacao, RESERVADOS };
