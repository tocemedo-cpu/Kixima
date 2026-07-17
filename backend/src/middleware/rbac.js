// src/middleware/rbac.js
// Controlo de acesso pelas 5 personas: COMPRADOR, COMPANY_ADMIN, FORNECEDOR,
// FINANCEIRO, ADMIN_SISTEMA. Usar depois de `authenticate`.

const { ForbiddenError } = require('../utils/errors');

/**
 * @param  {...string} allowedRoles Papéis autorizados para a rota.
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      throw new ForbiddenError();
    }
    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError(
        `Esta ação requer um dos seguintes perfis: ${allowedRoles.join(', ')}.`
      );
    }
    next();
  };
}

/**
 * Garante que o utilizador só acede a dados da própria empresa,
 * exceto o ADMIN_SISTEMA (interno KIXIMA, acede a todas).
 */
function requireSameCompany(getCompanyId) {
  return (req, res, next) => {
    if (req.user.role === 'ADMIN_SISTEMA') return next();

    const targetCompanyId = getCompanyId(req);
    if (!targetCompanyId || targetCompanyId !== req.user.companyId) {
      throw new ForbiddenError('Não pode aceder a dados de outra empresa.');
    }
    next();
  };
}

module.exports = { requireRole, requireSameCompany };
