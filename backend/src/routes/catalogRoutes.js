const express = require('express');
const catalogController = require('../controllers/catalogController');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { validate } = require('../utils/validate');
const { createProductSchema } = require('../utils/schemas');

const router = express.Router();

router.use(authenticate);

router.get('/', catalogController.list);
router.get('/:id', catalogController.getOne);
router.post('/', requireRole('FORNECEDOR', 'COMPANY_ADMIN'), validate(createProductSchema), catalogController.create);
router.put('/:id', requireRole('FORNECEDOR', 'COMPANY_ADMIN'), catalogController.update);
router.delete('/:id', requireRole('FORNECEDOR', 'COMPANY_ADMIN'), catalogController.deactivate);

module.exports = router;
