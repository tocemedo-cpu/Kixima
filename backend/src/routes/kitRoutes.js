const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { validate } = require('../utils/validate');
const { createKitSchema } = require('../utils/schemas');
const kitService = require('../services/kitService');
const auditService = require('../services/auditService');

const router = express.Router();

router.use(authenticate);

router.get('/', requireRole('FORNECEDOR', 'COMPANY_ADMIN'), async (req, res) => {
  res.json(await kitService.listKits(req.user.companyId));
});

router.post('/', requireRole('FORNECEDOR', 'COMPANY_ADMIN'), validate(createKitSchema), async (req, res) => {
  const kit = await kitService.createKit(req.user.companyId, req.body);
  await auditService.recordSafe({
    actor: auditService.actorFrom(req),
    action: 'CATALOGO_KIT_CRIADO',
    entityType: 'Kit',
    entityId: kit.id,
    entityRef: kit.name,
  });
  res.status(201).json(kit);
});

router.delete('/:id', requireRole('FORNECEDOR', 'COMPANY_ADMIN'), async (req, res) => {
  const r = await kitService.deleteKit(req.params.id, req.user.companyId);
  await auditService.recordSafe({
    actor: auditService.actorFrom(req),
    action: 'CATALOGO_KIT_REMOVIDO',
    entityType: 'Kit',
    entityId: req.params.id,
  });
  res.json(r);
});

module.exports = router;
