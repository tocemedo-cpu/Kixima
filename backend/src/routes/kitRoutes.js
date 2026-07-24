const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { validate } = require('../utils/validate');
const { createKitSchema } = require('../utils/schemas');
const kitService = require('../services/kitService');

const router = express.Router();

router.use(authenticate);

router.get('/', requireRole('FORNECEDOR', 'COMPANY_ADMIN'), async (req, res) => {
  res.json(await kitService.listKits(req.user.companyId));
});

router.post('/', requireRole('FORNECEDOR', 'COMPANY_ADMIN'), validate(createKitSchema), async (req, res) => {
  res.status(201).json(await kitService.createKit(req.user.companyId, req.body));
});

router.delete('/:id', requireRole('FORNECEDOR', 'COMPANY_ADMIN'), async (req, res) => {
  res.json(await kitService.deleteKit(req.params.id, req.user.companyId));
});

module.exports = router;
