// src/middleware/rateLimit.js
// Rate limiting (proteção contra brute-force e abuso). Um limite geral para
// toda a API e limites mais apertados para os endpoints sensíveis (login e
// fluxos de convite/registo). Em teste é desligado para não interferir.
const rateLimit = require('express-rate-limit');
const config = require('./../config/env');

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

// Limite geral para toda a API.
const apiLimiter = make({ windowMs: 15 * 60 * 1000, max: 600 });

// Limite apertado para autenticação (brute-force de credenciais).
const authLimiter = make({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true, // só conta tentativas falhadas
});

// Limite para fluxos públicos sensíveis (registo de empresa, aceitação de
// convite) — evita abuso/enumeração.
const sensitiveLimiter = make({ windowMs: 15 * 60 * 1000, max: 30 });

module.exports = { apiLimiter, authLimiter, sensitiveLimiter };
