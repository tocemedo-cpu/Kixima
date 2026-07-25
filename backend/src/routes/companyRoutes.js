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
  createInviteSchema,
  acceptInviteSchema,
} = require('../utils/schemas');

const router = express.Router();

// Documentos de credenciamento enviados no cadastro (um por tipo).
const registerDocs = uploadDocuments.fields([
  { name: 'CERTIDAO_COMERCIAL', maxCount: 1 },
  { name: 'ALVARA_COMERCIAL', maxCount: 1 },
  { name: 'LICENCA_ANPG', maxCount: 1 },
  { name: 'APOLICE_SEGURO', maxCount: 1 }, // documento da apólice (fornecedoras)
]);

// Cadastro público (onboarding) — sem autenticação. multipart: dados + documentos.
router.post('/register', registerDocs, validate(registerCompanySchema), companyController.register);

// Convites de utilizador (self-service) — resolução e aceitação são públicas: o
// token assinado é a autorização. Definidas antes de authenticate e de /:id.
router.get('/invite/:token', companyController.resolveInvite);
router.post('/invite/:token/accept', validate(acceptInviteSchema), companyController.acceptInvite);

router.use(authenticate);

// Utilizadores & Perfis da própria empresa (gerido pelo Company Admin).
// Antes de /:id para não colidir com o parâmetro.
router.get('/users', requireRole('COMPANY_ADMIN'), companyController.listUsers);
router.post('/invites', requireRole('COMPANY_ADMIN'), validate(createInviteSchema), companyController.createInvite);
router.patch('/users/:id/activate', requireRole('COMPANY_ADMIN'), companyController.activateUser);
router.patch('/users/:id/status', requireRole('COMPANY_ADMIN'), companyController.setUserStatus);
router.delete('/users/:id', requireRole('COMPANY_ADMIN'), companyController.removeUser);
// Criação direta de utilizador (Company Admin própria empresa ou Admin do Sistema).
router.post('/users', requireRole('COMPANY_ADMIN', 'ADMIN_SISTEMA'), validate(createUserSchema), companyController.createUser);

// Admin do Sistema KIXIMA: due diligence.
router.get('/', requireRole('ADMIN_SISTEMA'), companyController.list);
router.get('/:id', companyController.getOne);
router.patch('/:id/decision', requireRole('ADMIN_SISTEMA'), validate(decideCompanySchema), companyController.decide);
router.put('/:id/budget-limit', requireRole('COMPANY_ADMIN', 'ADMIN_SISTEMA'), validate(budgetLimitSchema), companyController.setBudgetLimit);

module.exports = router;
