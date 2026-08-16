// src/middleware/rbac.js
// Controlo de acesso pelas 5 personas: COMPRADOR, COMPANY_ADMIN, FORNECEDOR,
// FINANCEIRO, ADMIN_SISTEMA. Usar depois de `authenticate`.

const { ForbiddenError } = require('../utils/errors');
const { AREAS_ADMIN, AREAS_ADMIN_LABEL } = require('../utils/adminAreas');

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

/**
 * Restringe uma rota já aberta a ADMIN_SISTEMA a uma ÁREA específica.
 *
 * Usar SEMPRE depois de `requireRole(...)`, nunca sozinho: é o requireRole que
 * garante que só ADMIN_SISTEMA (e o mais que a rota permitir) chega aqui.
 *
 * NÃO AFETA outras personas — uma rota partilhada como
 * `requireRole('COMPANY_ADMIN', 'ADMIN_SISTEMA')` seguida de
 * `requirePermission('cadastro')` deixa o Company Admin exatamente como
 * estava; só filtra o ramo ADMIN_SISTEMA. `adminAreas` só existe para esse
 * papel — para todos os outros, esta verificação não diz respeito.
 *
 * `adminAreas` VAZIO continua a significar Super Admin: acede a tudo. É o
 * valor por omissão de quem já tinha o papel antes de as áreas existirem, de
 * propósito — ninguém perde acesso só por este campo ter passado a existir.
 */
function requirePermission(area) {
  return (req, res, next) => {
    if (req.user.role !== 'ADMIN_SISTEMA') return next();
    const areas = req.user.adminAreas || [];
    if (areas.length === 0 || areas.includes(area)) return next();
    throw new ForbiddenError(
      `Esta ação está fora das suas áreas. Precisa de "${AREAS_ADMIN_LABEL[area] || area}" — fale com quem lhe deu acesso ao sistema.`,
    );
  };
}

/**
 * Ações que NUNCA se delegam a um assessor com área restrita: gerir quem tem
 * acesso ao sistema, e a que áreas. Delegar isto anularia o próprio propósito
 * das áreas — um assessor de Suporte poderia atribuir-se Financeiro a si
 * próprio, ou bloquear a conta do Super Admin.
 */
function requireSuperAdmin() {
  return (req, res, next) => {
    if (req.user.role !== 'ADMIN_SISTEMA' || (req.user.adminAreas || []).length > 0) {
      throw new ForbiddenError('Esta ação está reservada ao Super Admin.');
    }
    next();
  };
}

module.exports = {
  requireRole, requireSameCompany, requirePermission, requireSuperAdmin, AREAS_ADMIN,
};
