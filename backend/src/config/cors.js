// src/config/cors.js
// Lista de origens aceites em CORS — partilhada entre o Express (app.js) e o
// Socket.IO (realtimeService.js). Cada um tinha a sua CÓPIA própria desta
// lógica, e foi exatamente isso que causou um bug: a origem do Capacitor foi
// acrescentada a uma cópia e esquecida na outra — o login passou a funcionar
// no Android, mas o chat em tempo real continuou mudo, pelo mesmo motivo que
// já se tinha corrigido no REST.
const config = require('./env');

// Origens fixas do WebView do Capacitor (Android/iOS) — não são um domínio de
// terceiros, são o esquema do próprio runtime nativo. Com androidScheme
// 'https' (Android, ver frontend/capacitor.config.json) e o esquema por
// omissão do Capacitor no iOS, o pedido sai sempre com Origin: https://
// localhost ou capacitor://localhost — nunca com o domínio kixima.net.
const ORIGENS_CAPACITOR = ['https://localhost', 'capacitor://localhost'];

function allowList() {
  return [config.appUrl, ...ORIGENS_CAPACITOR, ...String(process.env.CORS_ORIGINS || '').split(',')]
    .map((s) => (s || '').trim())
    .filter(Boolean);
}

// Callback no formato que tanto o pacote `cors` como as `cors options` do
// Socket.IO esperam: (origem, callback) => callback(erro, permitido).
function origin(origemDoPedido, cb) {
  if (!origemDoPedido) return cb(null, true); // same-origin, curl
  if (config.isDevelopment || config.isTest) return cb(null, true);
  // Origem não autorizada: não erra (não quebra pedidos same-origin que
  // enviam Origin em POST); apenas não autoriza — o browser bloqueia a
  // resposta cross-origin do seu lado.
  return cb(null, allowList().includes(origemDoPedido));
}

module.exports = { allowList, origin, ORIGENS_CAPACITOR };
