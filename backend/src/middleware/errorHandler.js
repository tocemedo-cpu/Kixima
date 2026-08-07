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

  // Erros de upload (multer) — ex.: ficheiro demasiado grande. Devolve uma
  // mensagem clara (413/400) em vez de um 500 genérico, para o utilizador saber
  // o que corrigir.
  if (err.name === 'MulterError') {
    const map = {
      LIMIT_FILE_SIZE: [413, 'O ficheiro é demasiado grande. Reduza o tamanho da imagem e tente novamente.'],
      LIMIT_FILE_COUNT: [400, 'Enviou ficheiros a mais.'],
      LIMIT_UNEXPECTED_FILE: [400, 'Campo de ficheiro inesperado no envio.'],
    };
    const [status, message] = map[err.code] || [400, 'Falha no envio do ficheiro.'];
    logger.warn(`Upload rejeitado: ${err.code}`, { path: req.path });
    return res.status(status).json({ error: { code: err.code, message } });
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
