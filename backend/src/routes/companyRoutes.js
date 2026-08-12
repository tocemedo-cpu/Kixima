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
  erpConfigSchema,
  bankDetailsSchema,
  companyPlanSchema,
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
router.get('/invites', requireRole('COMPANY_ADMIN'), companyController.listInvites);
router.post('/invites', requireRole('COMPANY_ADMIN'), validate(createInviteSchema), companyController.createInvite);
router.post('/invites/:id/resend', requireRole('COMPANY_ADMIN'), companyController.resendInvite);
router.post('/invites/:id/cancel', requireRole('COMPANY_ADMIN'), companyController.cancelInvite);
router.patch('/users/:id/activate', requireRole('COMPANY_ADMIN'), companyController.activateUser);
router.patch('/users/:id/status', requireRole('COMPANY_ADMIN'), companyController.setUserStatus);
router.delete('/users/:id', requireRole('COMPANY_ADMIN'), companyController.removeUser);
// Criação direta de utilizador (Company Admin própria empresa ou Admin do Sistema).
router.post('/users', requireRole('COMPANY_ADMIN', 'ADMIN_SISTEMA'), validate(createUserSchema), companyController.createUser);

// Admin do Sistema KIXIMA: due diligence.
router.get('/', requireRole('ADMIN_SISTEMA'), companyController.list);

// Configuração ERP por empresa — APENAS o Administrador do Sistema KIXIMA.
// (Antes de /:id para os segmentos específicos não colidirem com o parâmetro.)
router.get('/:id/erp-config', requireRole('ADMIN_SISTEMA'), companyController.getErpConfig);
router.put('/:id/erp-config', requireRole('ADMIN_SISTEMA'), validate(erpConfigSchema), companyController.setErpConfig);
router.post('/:id/erp-config/test', requireRole('ADMIN_SISTEMA'), companyController.testErpConnection);
router.get('/:id/erp-config/audits', requireRole('ADMIN_SISTEMA'), companyController.listErpAudits);

// Plano e dimensão — o Admin do Sistema define; a empresa consulta a sua
// subscrição (plano, utilizadores e custo mensal de acesso).
router.put('/:id/plan', requireRole('ADMIN_SISTEMA'), validate(companyPlanSchema), companyController.setPlan);
router.get('/:id/subscription', requireRole('COMPANY_ADMIN', 'FORNECEDOR', 'FINANCEIRO', 'ADMIN_SISTEMA'), companyController.getSubscription);

// Extrato da Taxa KIXIMA da empresa — a própria empresa (fornecedor) vê o que
// deve e porquê; o Admin do Sistema vê qualquer uma (documento de cobrança).
router.get('/:id/platform-fees', requireRole('FORNECEDOR', 'COMPANY_ADMIN', 'FINANCEIRO', 'ADMIN_SISTEMA'), companyController.platformFeeStatement);

// Dados bancários da empresa (para pagamentos) — geridos pela própria empresa.
router.get('/:id/bank-details', requireRole('FORNECEDOR', 'COMPANY_ADMIN', 'FINANCEIRO', 'ADMIN_SISTEMA'), companyController.getBankDetails);
router.put('/:id/bank-details', requireRole('FORNECEDOR', 'COMPANY_ADMIN', 'ADMIN_SISTEMA'), validate(bankDetailsSchema), companyController.setBankDetails);

router.get('/:id', companyController.getOne);
router.patch('/:id/decision', requireRole('ADMIN_SISTEMA'), validate(decideCompanySchema), companyController.decide);
router.put('/:id/budget-limit', requireRole('COMPANY_ADMIN', 'ADMIN_SISTEMA'), validate(budgetLimitSchema), companyController.setBudgetLimit);

module.exports = router;
