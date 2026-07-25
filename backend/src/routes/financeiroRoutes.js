// src/routes/financeiroRoutes.js
// Telas do Financeiro (Centro Financeiro, Faturas, Pagamentos). Leitura das
// agregações; a execução do pagamento continua em /api/payments/invoices/:id/pay.
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const svc = require('../services/financeiroService');

const router = express.Router();
router.use(authenticate);
router.use(requireRole('FINANCEIRO', 'COMPANY_ADMIN'));

router.get('/overview', async (req, res) => res.json(await svc.overview(req.user.companyId)));
router.get('/invoices', async (req, res) => res.json(await svc.invoices(req.user.companyId)));
router.get('/payments', async (req, res) => res.json(await svc.payments(req.user.companyId, req.query.status)));

module.exports = router;
