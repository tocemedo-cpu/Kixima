const express = require('express');
const poController = require('../controllers/poController');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { validate } = require('../utils/validate');
const { createPoSchema, rejectPoSchema, refusePoSchema, receptionSchema, resolveDivergenceSchema } = require('../utils/schemas');

const router = express.Router();

router.use(authenticate);

// 1. Checkout — Comprador emite a PO.
router.post('/', requireRole('COMPRADOR', 'COMPANY_ADMIN'), validate(createPoSchema), poController.create);
router.get('/', poController.list);
router.get('/:id', poController.getOne);
// Linha do tempo auditável — a mesma lista de todas as personas autorizadas
// (RBAC validado no service, não no cliente).
router.get('/:id/history', poController.history);

// 2. Aprovação — Company Admin (ponto único).
router.patch('/:id/approve', requireRole('COMPANY_ADMIN'), poController.approve);
router.patch('/:id/reject', requireRole('COMPANY_ADMIN'), validate(rejectPoSchema), poController.reject);

// 3. Fornecedor aceita/recusa -> 4. gera fatura + inicia relógio dos 7 dias.
router.patch('/:id/accept', requireRole('FORNECEDOR', 'COMPANY_ADMIN'), poController.accept);
router.patch('/:id/refuse', requireRole('FORNECEDOR', 'COMPANY_ADMIN'), validate(refusePoSchema), poController.refuse);

// 6. Execução/despacho — só após pagamento confirmado (validado no service).
router.patch('/:id/dispatch', requireRole('FORNECEDOR', 'COMPANY_ADMIN'), poController.dispatch);
router.patch('/:id/delivered', requireRole('FORNECEDOR', 'COMPANY_ADMIN'), poController.delivered);

// 7. Receção — Comprador confirma ou reporta divergência.
router.patch('/:id/reception', requireRole('COMPRADOR', 'COMPANY_ADMIN'), validate(receptionSchema), poController.receive);

// 7b. Comprador resolve a divergência (aceitar entrega ou pedir reposição).
router.patch('/:id/resolve-divergence', requireRole('COMPRADOR', 'COMPANY_ADMIN'), validate(resolveDivergenceSchema), poController.resolveDivergence);

module.exports = router;
