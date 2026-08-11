const express = require('express');
const paymentController = require('../controllers/paymentController');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
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

router.use(requireRole('FINANCEIRO', 'COMPANY_ADMIN'));

router.get('/invoices/pending', paymentController.pendingInvoices);
router.get('/history', paymentController.history);
// Pagamento com comprovativo OBRIGATÓRIO (multipart, campo "proof": PDF/imagem).
router.post('/invoices/:invoiceId/pay', uploadDocuments.single('proof'), paymentController.pay);

module.exports = router;
