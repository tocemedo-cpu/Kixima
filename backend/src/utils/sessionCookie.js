// src/utils/sessionCookie.js
// A sessão viaja num cookie httpOnly.
//
// PORQUE MUDOU. O token estava no localStorage, que é legível por qualquer
// JavaScript da página. Uma única falha de XSS — num campo de texto, numa
// dependência, num anexo servido na mesma origem — dava a quem a explorasse
// uma sessão completa, válida até expirar, de alguém que aprova pagamentos. Um
// cookie httpOnly não é legível por JavaScript nenhum: o browser envia-o, e o
// código da página nunca lhe toca.
//
// O QUE ISTO NÃO RESOLVE SOZINHO. Cookies são enviados automaticamente, e é
// isso que abre o CSRF: um sítio terceiro que faça o browser submeter um POST
// para a nossa API levaria o cookie com ele. A defesa é o SameSite:
//
//   Lax  — o cookie segue em navegações de topo por GET (alguém abre o link da
//          cotação a partir do email e continua com sessão) mas NÃO segue em
//          pedidos POST vindos de outro sítio, que é o vetor do CSRF.
//   Strict — bloquearia também o link do email, e a pessoa aparecia sem sessão
//          sem perceber porquê. Custo real, ganho nenhum aqui.
//
// O Bearer continua a ser aceite. Não é uma porta das traseiras: serve os
// clientes programáticos e a suite de testes, e não é por onde a interface
// autentica. A exposição que restava — o token vir no corpo da resposta do
// login — está descrita em authController.
const config = require('./../config/env');

const NOME = 'kixima_sessao';

// Tem de acompanhar a validade do próprio JWT: um cookie que dura mais do que
// o token deixa a pessoa "com sessão" a receber 401 em tudo, e um que dura
// menos deita fora uma sessão que ainda era válida.
function maxAgeMs() {
  const bruto = String(config.auth.jwtExpiresIn || '7d');
  const n = parseInt(bruto, 10);
  if (!Number.isFinite(n)) return 7 * 24 * 60 * 60 * 1000;
  if (bruto.endsWith('d')) return n * 24 * 60 * 60 * 1000;
  if (bruto.endsWith('h')) return n * 60 * 60 * 1000;
  if (bruto.endsWith('m')) return n * 60 * 1000;
  return n * 1000;
}

function opcoes() {
  return {
    httpOnly: true,
    // Secure só em produção: em desenvolvimento o servidor é http, e um cookie
    // Secure simplesmente não seria guardado — a sessão não funcionava e não
    // haveria erro nenhum a dizer porquê.
    secure: config.isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeMs(),
  };
}

function definir(res, token) {
  if (token) res.cookie(NOME, token, opcoes());
}

function limpar(res) {
  // As opções têm de coincidir com as da criação, exceto maxAge — o browser só
  // apaga um cookie quando o path e o sameSite batem certo.
  const { maxAge, ...resto } = opcoes();
  res.clearCookie(NOME, resto);
}

function ler(req) {
  return req.cookies?.[NOME] || null;
}

module.exports = { definir, limpar, ler, NOME, maxAgeMs };
