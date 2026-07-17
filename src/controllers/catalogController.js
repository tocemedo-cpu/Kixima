const catalogService = require('../services/catalogService');

async function list(req, res) {
  const products = await catalogService.listCatalog(req.query);
  res.json(products);
}

async function getOne(req, res) {
  const product = await catalogService.getProduct(req.params.id);
  res.json(product);
}

async function create(req, res) {
  const product = await catalogService.createProduct(req.user.companyId, req.body);
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

module.exports = { list, getOne, create, update, deactivate };
