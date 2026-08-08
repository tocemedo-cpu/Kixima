// src/config/sentry.js
// Rastreio de erros (Sentry). Inicializa apenas se SENTRY_DSN estiver definido —
// caso contrário, tudo aqui é no-op e a aplicação corre normalmente. Assim o
// mesmo código serve dev (sem DSN) e produção (com DSN), sem ramificações.
const Sentry = require('@sentry/node');
const config = require('./env');
const logger = require('./logger');

let enabled = false;

if (config.sentry.dsn && !config.isTest) {
  Sentry.init({
    dsn: config.sentry.dsn,
    environment: config.env,
    tracesSampleRate: config.sentry.tracesSampleRate,
  });
  enabled = true;
  logger.info('Sentry: rastreio de erros ativo.');
}

// Captura uma exceção com contexto do pedido. No-op se o Sentry não estiver
// configurado. Só deve ser chamado para erros inesperados (5xx), não para
// erros de validação/regra de negócio (4xx), que são o funcionamento normal.
function captureException(err, req) {
  if (!enabled) return;
  Sentry.captureException(err, {
    extra: req
      ? { method: req.method, path: req.originalUrl || req.path, userId: req.user?.id }
      : undefined,
  });
}

module.exports = { Sentry, enabled, captureException };
