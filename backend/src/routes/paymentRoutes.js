const express = require('express');
const paymentController = require('../controllers/paymentController');
const { authenticate } = require('../middleware/auth');
const { requireRole, requirePermission } = require('../middleware/rbac');
const { FATURACAO } = require('../utils/adminAreas');
const { uploadDocuments } = require('../config/upload');

const router = express.Router();

router.use(authenticate);

// Confirmação de receção do valor — lado do FORNECEDOR (antes do requireRole
// global do comprador, que se aplica só às rotas registadas depois).
router.patch(
  '/:paymentId/confirm-received',
  requireRole('FORNECEDOR', 'COMPANY_ADMIN', 'FINANCEIRO'),
  paymentController.confirmReceived,
);

// Nota de crédito — o fornecedor desta fatura corrige-a, ou o Admin do
// Sistema com a área FATURACAO (mesma permissão do resto da faturação
// certificada, ver faturacaoRoutes.js). requirePermission não faz nada a
// quem não é ADMIN_SISTEMA — a posse real é confirmada dentro do serviço.
router.post(
  '/invoices/:invoiceId/notas-credito',
  requireRole('FORNECEDOR', 'COMPANY_ADMIN', 'ADMIN_SISTEMA'),
  requirePermission(FATURACAO),
  paymentController.emitirNotaCredito,
);
router.get(
  '/invoices/:invoiceId/notas-credito',
  requireRole('FORNECEDOR', 'COMPANY_ADMIN', 'FINANCEIRO', 'COMPRADOR', 'ADMIN_SISTEMA'),
  requirePermission(FATURACAO),
  paymentController.listarNotasCredito,
);

router.use(requireRole('FINANCEIRO', 'COMPANY_ADMIN'));

router.get('/invoices/pending', paymentController.pendingInvoices);
router.get('/history', paymentController.history);
// Pagamento com comprovativo OBRIGATÓRIO (multipart, campo "proof": PDF/imagem).
router.post('/invoices/:invoiceId/pay', uploadDocuments.single('proof'), paymentController.pay);

module.exports = router;
