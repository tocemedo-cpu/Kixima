const express = require('express');
const prisma = require('../config/database');
const auditService = require('../services/auditService');
const apiKeyService = require('../services/apiKeyService');
const catalogController = require('../controllers/catalogController');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { validate } = require('../utils/validate');
const { createProductSchema, updateProductSchema, stockUpdateSchema, stockMovementSchema, reviewSchema } = require('../utils/schemas');
const { upload, uploadProductMedia, uploadSpreadsheet } = require('../config/upload');

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
// Importação em massa por Excel (.xlsx) — antes de /:id para não colidir.
router.post('/import', requireRole('FORNECEDOR', 'COMPANY_ADMIN'), uploadSpreadsheet.single('file'), catalogController.importCatalog);
// Documentos do fornecedor (Documentação) — antes de /:id para não colidir.
router.get('/documents', requireRole('FORNECEDOR', 'COMPANY_ADMIN'), catalogController.documents);
// Movimentos de inventário (Entradas/Saídas) — antes de /:id.
router.get('/movements', requireRole('FORNECEDOR', 'COMPANY_ADMIN'), catalogController.listMovements);
router.post('/movements', requireRole('FORNECEDOR', 'COMPANY_ADMIN'), validate(stockMovementSchema), catalogController.createMovement);
// --- Chaves da API de catálogo (plano Pro) ---
// ANTES das rotas com parâmetro. O Express faz corresponder por ordem, e
// `/:id` apanharia `/api-keys` — a listagem devolvia "produto não encontrado" e
// a interface mostrava uma lista vazia sem erro nenhum.-------------------------------
// Ficam aqui, ao lado do catálogo, porque é isso que a chave alcança — e é a
// leitura certa para quem a cria: não é "uma chave da KIXIMA", é uma chave do
// meu catálogo.
router.get('/api-keys', requireRole('FORNECEDOR', 'COMPANY_ADMIN'), async (req, res) => {
  res.json(await apiKeyService.listar(req.user.companyId));
});

router.post('/api-keys', requireRole('FORNECEDOR', 'COMPANY_ADMIN'), async (req, res) => {
  const empresa = await prisma.company.findUnique({ where: { id: req.user.companyId } });
  const criada = await apiKeyService.criar(empresa, { nome: req.body?.nome }, req.user.id);
  await auditService.recordSafe({
    actor: auditService.actorFrom(req),
    action: 'CHAVE_API_CRIADA',
    entityType: 'ApiKey',
    entityId: criada.id,
    entityRef: criada.prefixo,
    detail: { nome: criada.nome },
  });
  res.status(201).json(criada);
});

router.delete('/api-keys/:id', requireRole('FORNECEDOR', 'COMPANY_ADMIN'), async (req, res) => {
  const r = await apiKeyService.revogar(req.user.companyId, req.params.id);
  await auditService.recordSafe({
    actor: auditService.actorFrom(req),
    action: 'CHAVE_API_REVOGADA',
    entityType: 'ApiKey',
    entityId: req.params.id,
  });
  res.json(r);
});

router.get('/slug/:slug', catalogController.getBySlug);
router.get('/:id', catalogController.getOne);
router.get('/:id/reviews', catalogController.listReviews);
router.post('/:id/reviews', requireRole('COMPRADOR'), validate(reviewSchema), catalogController.addReview);
router.post('/', requireRole('FORNECEDOR', 'COMPANY_ADMIN'), productMedia, validate(createProductSchema), catalogController.create);
router.put('/:id', requireRole('FORNECEDOR', 'COMPANY_ADMIN'), validate(updateProductSchema), catalogController.update);
router.patch('/:id/stock', requireRole('FORNECEDOR', 'COMPANY_ADMIN'), validate(stockUpdateSchema), catalogController.updateStock);
router.post('/:id/image', requireRole('FORNECEDOR', 'COMPANY_ADMIN'), upload.single('image'), catalogController.uploadImage);
router.delete('/:id', requireRole('FORNECEDOR', 'COMPANY_ADMIN'), catalogController.deactivate);

module.exports = router;
