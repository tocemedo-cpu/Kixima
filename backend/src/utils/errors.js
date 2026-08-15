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

/**
 * Bateu-se num limite ou numa funcionalidade que o plano não inclui.
 *
 * Tem código próprio para a interface poder oferecer o caminho para a página de
 * subscrição. Com o código genérico de regra de negócio ela teria de reconhecer
 * o muro pelo TEXTO da mensagem — e uma frase reescrita partia o botão sem que
 * teste nenhum reparasse. O plano necessário viaja à parte para a interface
 * poder dizer qual é sem o extrair da frase.
 */
class PlanRequiredError extends BusinessRuleError {
  constructor(message, planoNecessario = null) {
    super(message);
    this.code = 'PLANO_INSUFICIENTE';
    this.details = { planoNecessario };
  }
}

module.exports = {
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  PlanRequiredError,
  BusinessRuleError,
};
