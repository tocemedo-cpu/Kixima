const express = require('express');
const catalogController = require('../controllers/catalogController');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { validate } = require('../utils/validate');
const { createProductSchema, updateProductSchema, stockUpdateSchema, stockMovementSchema } = require('../utils/schemas');
const { upload, uploadProductMedia } = require('../config/upload');

const router = express.Router();

// Campos multipart aceites no cadastro de produto: imagem principal, galeria e
// os documentos técnicos (cada tipo pode ter vários ficheiros).
const productMedia = uploadProductMedia.fields([
  { name: 'mainImage', maxCount: 1 },
  { name: 'gallery', maxCount: 10 },
  { name: 'FICHA_TECNICA', maxCount: 5 },
  { name: 'DATASHEET', maxCount: 5 },
  { name: 'MANUAL', maxCount: 5 },
  { name: 'CATALOGO', maxCount: 5 },
  { name: 'CERTIFICADO', maxCount: 5 },
  { name: 'DESENHO_TECNICO', maxCount: 5 },
]);

router.use(authenticate);

router.get('/', catalogController.list);
// Documentos do fornecedor (Documentação) — antes de /:id para não colidir.
router.get('/documents', requireRole('FORNECEDOR', 'COMPANY_ADMIN'), catalogController.documents);
// Movimentos de inventário (Entradas/Saídas) — antes de /:id.
router.get('/movements', requireRole('FORNECEDOR', 'COMPANY_ADMIN'), catalogController.listMovements);
router.post('/movements', requireRole('FORNECEDOR', 'COMPANY_ADMIN'), validate(stockMovementSchema), catalogController.createMovement);
router.get('/:id', catalogController.getOne);
router.post('/', requireRole('FORNECEDOR', 'COMPANY_ADMIN'), productMedia, validate(createProductSchema), catalogController.create);
router.put('/:id', requireRole('FORNECEDOR', 'COMPANY_ADMIN'), validate(updateProductSchema), catalogController.update);
router.patch('/:id/stock', requireRole('FORNECEDOR', 'COMPANY_ADMIN'), validate(stockUpdateSchema), catalogController.updateStock);
router.post('/:id/image', requireRole('FORNECEDOR', 'COMPANY_ADMIN'), upload.single('image'), catalogController.uploadImage);
router.delete('/:id', requireRole('FORNECEDOR', 'COMPANY_ADMIN'), catalogController.deactivate);

module.exports = router;
