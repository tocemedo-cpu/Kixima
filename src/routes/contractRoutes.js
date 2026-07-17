const express = require('express');
const contractController = require('../controllers/contractController');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { validate } = require('../utils/validate');
const { createContractSchema } = require('../utils/schemas');

const router = express.Router();

router.use(authenticate);

router.post('/', requireRole('ADMIN_SISTEMA', 'COMPANY_ADMIN'), validate(createContractSchema), contractController.create);
router.get('/', contractController.listMine);
router.get('/:id', contractController.getOne);
router.post('/:id/consolidate-billing', requireRole('ADMIN_SISTEMA', 'FINANCEIRO', 'COMPANY_ADMIN'), contractController.consolidateBilling);

module.exports = router;
