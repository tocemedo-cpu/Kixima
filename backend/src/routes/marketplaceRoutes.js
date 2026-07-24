const express = require('express');
const { authenticate } = require('../middleware/auth');
const { ValidationError } = require('../utils/errors');
const { marketplaceSearchSchema, favoriteSchema } = require('../utils/schemas');
const marketplaceService = require('../services/marketplaceService');
const favoriteService = require('../services/favoriteService');

const router = express.Router();
router.use(authenticate);

// Interpreta e saneia os parâmetros de pesquisa (sem reatribuir req.query).
function parseFilters(req) {
  const parsed = marketplaceSearchSchema.safeParse(req.query);
  if (!parsed.success) throw new ValidationError('Parâmetros de pesquisa inválidos.', parsed.error.flatten());
  const f = { ...parsed.data };
  f.certifications = f.certifications ? f.certifications.split(',').map((s) => s.trim()).filter(Boolean) : [];
  f.verified = f.verified === 'true';
  // Um comprador nunca vê produtos da própria empresa.
  if (req.user.role === 'COMPRADOR') f.excludeSupplierId = req.user.companyId;
  return f;
}

router.get('/search', async (req, res) => {
  res.json(await marketplaceService.search(parseFilters(req), { userId: req.user.id }));
});

router.get('/facets', async (req, res) => {
  res.json(await marketplaceService.facets(parseFilters(req)));
});

router.get('/suppliers', async (req, res) => {
  res.json(await marketplaceService.verifiedSuppliers(8));
});

// Favoritos do utilizador autenticado.
router.get('/favorites', async (req, res) => {
  res.json(await favoriteService.listIds(req.user.id));
});
router.post('/favorites', async (req, res) => {
  const parsed = favoriteSchema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError('Favorito inválido.', parsed.error.flatten());
  res.status(201).json(await favoriteService.add(req.user.id, parsed.data.productId));
});
router.delete('/favorites/:productId', async (req, res) => {
  res.json(await favoriteService.remove(req.user.id, req.params.productId));
});

module.exports = router;
