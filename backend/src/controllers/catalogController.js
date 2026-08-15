const catalogService = require('../services/catalogService');
const reviewService = require('../services/reviewService');
const catalogImportService = require('../services/catalogImportService');

const PRODUCT_DOC_TYPES = ['FICHA_TECNICA', 'DATASHEET', 'MANUAL', 'CATALOGO', 'CERTIFICADO', 'DESENHO_TECNICO'];

async function list(req, res) {
  // Compradores não veem produtos da própria empresa (não podem comprá-los).
  const excludeSupplierId = req.user.role === 'COMPRADOR' ? req.user.companyId : undefined;
  const products = await catalogService.listCatalog({ ...req.query, excludeSupplierId });
  res.json(products);
}

async function getOne(req, res) {
  const product = await catalogService.getProduct(req.params.id);
  // Conta a visualização quando é um comprador a ver (não o próprio fornecedor).
  if (req.user.role === 'COMPRADOR' && product.supplierId !== req.user.companyId) {
    catalogService.incrementView(product.id); // best-effort, não bloqueia a resposta
  }
  res.json(product);
}

async function getBySlug(req, res) {
  const product = await catalogService.getProductBySlug(req.params.slug);
  if (req.user.role === 'COMPRADOR' && product.supplierId !== req.user.companyId) {
    catalogService.incrementView(product.id);
  }
  res.json(product);
}

async function listReviews(req, res) {
  res.json(await reviewService.listForProduct(req.params.id));
}

async function addReview(req, res) {
  const result = await reviewService.addReview(req.params.id, req.user.id, req.body);
  res.status(201).json(result);
}

async function create(req, res) {
  // multipart: campos de texto em req.body; ficheiros em req.files (por campo).
  const files = req.files || {};
  const media = {
    mainImage: files.mainImage && files.mainImage[0],
    gallery: files.gallery || [],
    documents: PRODUCT_DOC_TYPES.flatMap((type) => (files[type] || []).map((file) => ({ type, file }))),
  };
  const product = await catalogService.createProduct(req.user.companyId, req.body, media);
  res.status(201).json(product);
}

async function update(req, res) {
  const product = await catalogService.updateProduct(req.params.id, req.user.companyId, req.body);
  res.json(product);
}

async function updateStock(req, res) {
  const product = await catalogService.updateStock(req.params.id, req.user.companyId, req.body);
  res.json(product);
}

async function documents(req, res) {
  const docs = await catalogService.listSupplierDocuments(req.user.companyId);
  res.json(docs);
}

async function listMovements(req, res) {
  const movements = await catalogService.listStockMovements(req.user.companyId, {
    type: req.query.type, page: req.query.page, limit: req.query.limit,
  });
  res.json(movements);
}

async function createMovement(req, res) {
  const movement = await catalogService.createStockMovement(req.user.companyId, req.user.id, req.body);
  res.status(201).json(movement);
}

async function deactivate(req, res) {
  const product = await catalogService.deactivateProduct(req.params.id, req.user.companyId);
  res.json(product);
}

async function uploadImage(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: { code: 'NO_FILE', message: 'Nenhuma imagem enviada.' } });
  }
  const product = await catalogService.setProductImage(req.params.id, req.user.companyId, req.file);
  return res.json(product);
}

// Importação de catálogo em massa (Excel .xlsx) — o Fornecedor carrega os seus
// produtos de uma vez. Company Admin importa para a própria empresa.
async function importCatalog(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: { code: 'NO_FILE', message: 'Envie um ficheiro Excel (.xlsx).' } });
  }
  const result = await catalogImportService.importCatalog(req.file.buffer, req.user.companyId);
  return res.status(201).json(result);
}

module.exports = { list, getOne, getBySlug, create, update, updateStock, documents, listMovements, createMovement, listReviews, addReview, deactivate, uploadImage, importCatalog };
