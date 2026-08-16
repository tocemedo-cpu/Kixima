const express = require('express');
const policyController = require('../controllers/policyController');
const { authenticate } = require('../middleware/auth');
const { requireRole, requirePermission } = require('../middleware/rbac');
const { APOLICES } = require('../utils/adminAreas');
const { validate } = require('../utils/validate');
const { supplierPolicySchema, clientPolicySchema } = require('../utils/schemas');

const router = express.Router();

router.use(authenticate);

// Fornecedor → KIXIMA: submetida no onboarding pelo próprio fornecedor.
router.post(
  '/supplier-to-kixima',
  requireRole('FORNECEDOR', 'COMPANY_ADMIN'),
  validate(supplierPolicySchema),
  policyController.submitSupplierPolicy
);
router.patch('/supplier-to-kixima/:id/decision', requireRole('ADMIN_SISTEMA'), requirePermission(APOLICES), policyController.decideSupplierPolicy);

// KIXIMA → Cliente: emitida pelo Admin do Sistema após due diligence.
router.post(
  '/kixima-to-client/:companyId',
  requireRole('ADMIN_SISTEMA'),
  requirePermission(APOLICES),
  validate(clientPolicySchema),
  policyController.issueClientPolicy
);

// Consulta (perfil da empresa) — partilhado entre Company Admin e Financeiro.
router.get('/company/:companyId?', policyController.listForCompany);

module.exports = router;
