const express = require('express');
const paymentController = require('../controllers/paymentController');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticate);
router.use(requireRole('FINANCEIRO', 'COMPANY_ADMIN'));

router.get('/invoices/pending', paymentController.pendingInvoices);
router.get('/history', paymentController.history);
router.post('/invoices/:invoiceId/pay', paymentController.pay);

module.exports = router;
