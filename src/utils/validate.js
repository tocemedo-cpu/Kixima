// src/utils/validate.js
// Middleware genérico de validação com Zod.

const { ValidationError } = require('./errors');

/**
 * @param {import('zod').ZodSchema} schema
 * @param {'body'|'query'|'params'} location
 */
function validate(schema, location = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[location]);
    if (!result.success) {
      throw new ValidationError('Dados inválidos.', result.error.flatten());
    }
    req[location] = result.data;
    next();
  };
}

module.exports = { validate };
