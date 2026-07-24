const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const reportsService = require('../services/reportsService');

const router = express.Router();

router.use(authenticate);

// Estatísticas do fornecedor (catálogo, ordens, receita, mais vendidos).
router.get('/fornecedor', requireRole('FORNECEDOR', 'COMPANY_ADMIN'), async (req, res) => {
  const stats = await reportsService.supplierStats(req.user.companyId);
  res.json(stats);
});

module.exports = router;
