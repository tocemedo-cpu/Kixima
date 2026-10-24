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
// ACESSO DA EQUIPA. Quem trabalha na plataforma precisa de a ver com o modo ligado. Com a variável
// LAUNCH_BYPASS_KEY definida (segredo, só no painel do Render; mínimo 16 caracteres), abrir qualquer
// página com ?acesso=<chave> (ex.: https://kixima.net/login?acesso=...) grava um cookie httpOnly
// (kixima_equipa, 30 dias, HMAC da chave — nunca a própria chave) e redirecciona para o mesmo
// endereço sem o parâmetro. Com o cookie válido o servidor serve a aplicação normal e o /launch.json
// passa a responder { "enabled": false } só a essa pessoa. ?acesso=sair apaga o cookie. Sem a variável
// (ou com uma chave curta) o acesso da equipa fica DESLIGADO e o modo é estrito para toda a gente.
// Mudar a chave invalida todos os cookies. A API nunca depende disto.
//
// O interruptor é relido quando o ficheiro muda (mtime + tamanho), sem reiniciar.
// Falha para o site de sempre: sem ficheiro, JSON inválido ou valor que não seja
// exactamente `true` → desligado. Ligado mas sem launch.html no dist → avisa uma vez e
// segue com a app (a guarda do próprio SPA mostra então a página de lançamento).
const crypto = require('crypto');
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


// --- Acesso da equipa -----------------------------------------------------------------------
const COOKIE_EQUIPA = 'kixima_equipa';
const PARAM_ACESSO = 'acesso';
const TRINTA_DIAS_MS = 30 * 24 * 60 * 60 * 1000;
const CHAVE_MINIMA = 16;

function tokenDe(chave) {
  return crypto.createHmac('sha256', chave).update('kixima-equipa-v1').digest('hex');
}

function iguais(a, b) {
  const A = Buffer.from(String(a)); const B = Buffer.from(String(b));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

function lerCookie(req, nome) {
  if (req.cookies && typeof req.cookies[nome] === 'string') return req.cookies[nome];
  const bruto = req.headers && req.headers.cookie;
  if (!bruto) return null;
  for (const par of bruto.split(';')) {
    const i = par.indexOf('=');
    if (i > 0 && par.slice(0, i).trim() === nome) return decodeURIComponent(par.slice(i + 1).trim());
  }
  return null;
}

function criarAcessoEquipa(chave) {
  const ativo = typeof chave === 'string' && chave.length >= CHAVE_MINIMA;
  const esperado = ativo ? tokenDe(chave) : null;
  const opcoesCookie = (req) => ({ httpOnly: true, sameSite: 'lax', secure: !!req.secure, path: '/' });

  function temAcesso(req) {
    if (!ativo) return false;
    const c = lerCookie(req, COOKIE_EQUIPA);
    return !!c && iguais(c, esperado);
  }

  // ?acesso=<chave> grava o cookie, ?acesso=sair apaga-o; em ambos redirecciona para o mesmo
  // endereço sem o parâmetro (a chave não fica no histórico nem em marcadores). true = respondeu.
  function tratar(req, res) {
    if (!ativo || (req.method !== 'GET' && req.method !== 'HEAD')) return false;
    const valor = req.query && req.query[PARAM_ACESSO];
    if (typeof valor !== 'string') return false;
    const sair = valor === 'sair';
    if (!sair && !iguais(valor, chave)) return false; // chave errada: ignora em silêncio (nada a descobrir)
    if (sair) res.clearCookie(COOKIE_EQUIPA, opcoesCookie(req));
    else res.cookie(COOKIE_EQUIPA, esperado, { ...opcoesCookie(req), maxAge: TRINTA_DIAS_MS });
    const resto = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) if (k !== PARAM_ACESSO && typeof v === 'string') resto.append(k, v);
    const q = resto.toString();
    res.set('Cache-Control', 'no-store');
    res.redirect(302, `${req.path}${q ? `?${q}` : ''}`);
    return true;
  }

  return { ativo, temAcesso, tratar };
}

function criarLancamento(distDir, { aviso = (m) => console.warn(m), acesso = null } = {}) {
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
    if (acesso && acesso.temAcesso(req)) return false; // equipa com cookie válido: vê a aplicação
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
  const acesso = criarAcessoEquipa(opcoes.chaveEquipa !== undefined ? opcoes.chaveEquipa : process.env.LAUNCH_BYPASS_KEY);
  const lancamento = criarLancamento(frontendDist, { ...opcoes, acesso });
  app.use((req, res, next) => {
    const navega = (req.method === 'GET' || req.method === 'HEAD') && !eReservado(req.path || '/');
    if (navega && acesso.tratar(req, res)) return undefined;
    // Para a equipa, o interruptor lido pelo SPA responde "desligado" (só a ela; o ficheiro não muda).
    if (navega && req.path === '/launch.json' && acesso.temAcesso(req)) {
      return res.set('Cache-Control', 'no-store').json({ enabled: false });
    }
    return lancamento.servir(req, res) ? undefined : next();
  });
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

module.exports = { montarFrontend, criarLancamento, criarAcessoEquipa, ePaginaDeNavegacao, RESERVADOS, COOKIE_EQUIPA };
