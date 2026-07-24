const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const dashboardService = require('../services/dashboardService');

const router = express.Router();
router.use(authenticate);

router.get('/comprador', requireRole('COMPRADOR'), async (req, res) => {
  res.json(await dashboardService.buyerSummary(req.user.companyId));
});

module.exports = router;
