const catalogService = require('../services/catalogService');

const PRODUCT_DOC_TYPES = ['FICHA_TECNICA', 'DATASHEET', 'MANUAL', 'CATALOGO', 'CERTIFICADO', 'DESENHO_TECNICO'];

async function list(req, res) {
  const products = await catalogService.listCatalog(req.query);
  res.json(products);
}

async function getOne(req, res) {
  const product = await catalogService.getProduct(req.params.id);
  res.json(product);
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

module.exports = { list, getOne, create, update, deactivate, uploadImage };
