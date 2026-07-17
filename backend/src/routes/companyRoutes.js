const express = require('express');
const companyController = require('../controllers/companyController');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { validate } = require('../utils/validate');
const {
  registerCompanySchema,
  decideCompanySchema,
  createUserSchema,
  budgetLimitSchema,
} = require('../utils/schemas');

const router = express.Router();

// Cadastro público (onboarding) — sem autenticação.
router.post('/register', validate(registerCompanySchema), companyController.register);

router.use(authenticate);

// Admin do Sistema KIXIMA: due diligence.
router.get('/', requireRole('ADMIN_SISTEMA'), companyController.list);
router.get('/:id', companyController.getOne);
router.patch('/:id/decision', requireRole('ADMIN_SISTEMA'), validate(decideCompanySchema), companyController.decide);
router.put('/:id/budget-limit', requireRole('COMPANY_ADMIN', 'ADMIN_SISTEMA'), validate(budgetLimitSchema), companyController.setBudgetLimit);

// Utilizadores & Perfis — gerido pelo Company Admin (própria empresa) ou Admin do Sistema.
router.post('/users', requireRole('COMPANY_ADMIN', 'ADMIN_SISTEMA'), validate(createUserSchema), companyController.createUser);

module.exports = router;
