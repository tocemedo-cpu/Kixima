const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { validate } = require('../utils/validate');
const { createQuoteSchema, respondQuoteSchema } = require('../utils/schemas');
const quoteService = require('../services/quoteService');

const router = express.Router();

router.use(authenticate);

// Lista conforme a persona: comprador vê os seus pedidos, fornecedor os que recebeu.
router.get('/', async (req, res) => {
  const { role, companyId } = req.user;
  const status = req.query.status;
  if (role === 'FORNECEDOR' || role === 'COMPANY_ADMIN') {
    return res.json(await quoteService.listForSupplier(companyId, { status }));
  }
  return res.json(await quoteService.listForBuyer(companyId, { status }));
});

// Comprador cria o pedido de cotação.
router.post('/', requireRole('COMPRADOR'), validate(createQuoteSchema), async (req, res) => {
  res.status(201).json(await quoteService.createRequest(req.user.companyId, req.user.id, req.body));
});

// Fornecedor responde com preço/prazo.
router.patch('/:id/respond', requireRole('FORNECEDOR', 'COMPANY_ADMIN'), validate(respondQuoteSchema), async (req, res) => {
  res.json(await quoteService.respond(req.params.id, req.user.companyId, req.body));
});

// Comprador encerra o pedido.
router.patch('/:id/close', requireRole('COMPRADOR'), async (req, res) => {
  res.json(await quoteService.close(req.params.id, req.user.companyId));
});

module.exports = router;
