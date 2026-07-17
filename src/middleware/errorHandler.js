// src/middleware/errorHandler.js
// Middleware central de tratamento de erros. Deve ser o último `app.use()`.

const config = require('../config/env');
const logger = require('../config/logger');
const { AppError } = require('../utils/errors');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(err.message, { code: err.code, stack: err.stack });
    } else {
      logger.warn(err.message, { code: err.code, path: req.path });
    }
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
  }

  // Erros do Prisma (constraint violations, etc.)
  if (err.code === 'P2002') {
    return res.status(409).json({
      error: { code: 'UNIQUE_CONSTRAINT', message: 'Já existe um registo com estes dados.' },
    });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Recurso não encontrado.' },
    });
  }

  logger.error('Erro não tratado', { message: err.message, stack: err.stack });

  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Ocorreu um erro interno. Tente novamente mais tarde.',
      ...(config.isDevelopment ? { stack: err.stack } : {}),
    },
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    error: { code: 'ROUTE_NOT_FOUND', message: `Rota ${req.method} ${req.path} não existe.` },
  });
}

module.exports = { errorHandler, notFoundHandler };
