// src/middleware/rateLimit.js
// Rate limiting (proteção contra brute-force e abuso). Um limite geral para
// toda a API e limites mais apertados para os endpoints sensíveis (login e
// fluxos de convite/registo). Em teste é desligado para não interferir.
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const config = require('./../config/env');
const sessionCookie = require('../utils/sessionCookie');

const disabled = config.isTest;

// Fábrica que, em ambiente de teste, devolve um middleware no-op.
function make(options) {
  if (disabled) return (req, res, next) => next();
  return rateLimit({
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Demasiados pedidos. Tente novamente mais tarde.' } },
    ...options,
  });
}

/**
 * A quem se conta este pedido: à PESSOA quando há sessão, ao endereço quando
 * não há.
 *
 * PORQUE NÃO SÓ AO ENDEREÇO. Em Angola é normal uma empresa inteira sair para a
 * internet por um endereço só. Contar por IP faz com que 600 pedidos por 15
 * minutos — folgadíssimos para uma pessoa — sejam 1,3 pedidos por minuto por
 * cabeça num escritório de trinta. O resultado é uma plataforma que fica
 * "lenta e a dar erros" a meio da manhã, sem nada nos registos que aponte ao
 * limitador.
 *
 * A assinatura do token é verificada (é barato — é um HMAC, sem ida à base)
 * porque sem isso qualquer um podia escrever um `sub` alheio e gastar o
 * orçamento de outra pessoa.
 */
function porUtilizadorOuIp(req) {
  const token = sessionCookie.ler(req)
    || (String(req.headers.authorization || '').split(' ')[1] ?? null);
  if (token) {
    try {
      const { sub } = jwt.verify(token, config.auth.jwtSecret, { algorithms: ['HS256'] });
      if (sub) return `u:${sub}`;
    } catch {
      // Token inválido/expirado: conta como anónimo, pelo endereço.
    }
  }
  // ipKeyGenerator normaliza IPv6 — sem ele, cada pedido de um cliente IPv6
  // podia cair num balde diferente e o limite não valia nada.
  return `ip:${ipKeyGenerator(req.ip)}`;
}

// Limite geral da API. Generoso de propósito: não é aqui que se trava um
// ataque (isso é o bloqueio por conta e os limites dos endpoints sensíveis) —
// é aqui que se trava uma inundação.
const apiLimiter = make({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.API_RATE_LIMIT) || 600,
  keyGenerator: porUtilizadorOuIp,
});

// Limite por IP na autenticação.
//
// PORQUE É QUE SUBIU DE 20 PARA 60. Desde que existe bloqueio POR CONTA
// (loginAttemptService: 5 falhas e a conta fecha por tempo crescente), a defesa
// contra força bruta é essa — precisa, dirigida à conta atacada, e independente
// de quantos endereços o atacante use. Este limite passou a ser o instrumento
// grosseiro: serve para travar inundação, não para contar tentativas.
//
// E um instrumento grosseiro apertado de mais castiga quem não devia. Em Angola
// é comum uma empresa inteira sair para a internet por um único endereço: com o
// limite a 20, bastavam alguns enganos numa segunda-feira de manhã para o
// escritório todo deixar de conseguir sequer TENTAR entrar — incluindo quem
// tinha a senha certa. O ataque continuava a ter 5 tentativas por conta; os
// prejudicados eram os trinta funcionários.
const authLimiter = make({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT) || 60,
  skipSuccessfulRequests: true, // quem acerta não gasta orçamento nenhum
});

// Limite para fluxos públicos sensíveis (registo de empresa, aceitação de
// convite) — evita abuso/enumeração.
const sensitiveLimiter = make({ windowMs: 15 * 60 * 1000, max: 30 });

// Envio de mensagens de chat (Suporte e Comercial) — mais apertado do que o
// limite geral da API, propositadamente: o resto da API é "uma pessoa a
// clicar", isto é "uma pessoa a escrever", e um flood de mensagens é o vetor
// de abuso mais direto num chat. 60/min é generoso para conversa humana e
// travaria um script a martelar o endpoint.
const chatMessageLimiter = make({
  windowMs: 60 * 1000,
  max: Number(process.env.CHAT_RATE_LIMIT) || 60,
  keyGenerator: porUtilizadorOuIp,
});

module.exports = { make, apiLimiter, authLimiter, sensitiveLimiter, chatMessageLimiter, porUtilizadorOuIp };
