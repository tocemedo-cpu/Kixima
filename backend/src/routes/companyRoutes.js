const express = require('express');
const companyController = require('../controllers/companyController');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { validate } = require('../utils/validate');
const { uploadDocuments } = require('../config/upload');
const {
  registerCompanySchema,
  decideCompanySchema,
  createUserSchema,
  budgetLimitSchema,
} = require('../utils/schemas');

const router = express.Router();

// Documentos de credenciamento enviados no cadastro (um por tipo).
const registerDocs = uploadDocuments.fields([
  { name: 'CERTIDAO_COMERCIAL', maxCount: 1 },
  { name: 'ALVARA_COMERCIAL', maxCount: 1 },
  { name: 'LICENCA_ANPG', maxCount: 1 },
]);

// Cadastro público (onboarding) — sem autenticação. multipart: dados + documentos.
router.post('/register', registerDocs, validate(registerCompanySchema), companyController.register);

router.use(authenticate);

// Admin do Sistema KIXIMA: due diligence.
router.get('/', requireRole('ADMIN_SISTEMA'), companyController.list);
router.get('/:id', companyController.getOne);
router.patch('/:id/decision', requireRole('ADMIN_SISTEMA'), validate(decideCompanySchema), companyController.decide);
router.put('/:id/budget-limit', requireRole('COMPANY_ADMIN', 'ADMIN_SISTEMA'), validate(budgetLimitSchema), companyController.setBudgetLimit);

// Utilizadores & Perfis — gerido pelo Company Admin (própria empresa) ou Admin do Sistema.
router.post('/users', requireRole('COMPANY_ADMIN', 'ADMIN_SISTEMA'), validate(createUserSchema), companyController.createUser);

module.exports = router;
