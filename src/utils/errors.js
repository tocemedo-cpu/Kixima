// src/utils/errors.js
// Classes de erro previsíveis, capturadas pelo errorHandler central.

class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

class NotFoundError extends AppError {
  constructor(entity = 'Recurso') {
    super(`${entity} não encontrado.`, 404, 'NOT_FOUND');
  }
}

class ValidationError extends AppError {
  constructor(message, details) {
    super(message || 'Dados inválidos.', 422, 'VALIDATION_ERROR');
    this.details = details;
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Não autenticado.') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Sem permissão para esta ação.') {
    super(message, 403, 'FORBIDDEN');
  }
}

class ConflictError extends AppError {
  constructor(message = 'Conflito de estado.') {
    super(message, 409, 'CONFLICT');
  }
}

class BusinessRuleError extends AppError {
  constructor(message) {
    super(message, 400, 'BUSINESS_RULE_VIOLATION');
  }
}

module.exports = {
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  BusinessRuleError,
};
