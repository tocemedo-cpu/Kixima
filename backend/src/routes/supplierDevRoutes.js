// src/routes/supplierDevRoutes.js
// Supplier Development. A CANDIDATURA é pública (entra pela página de login e
// pela home — a empresa pode nem ter conta ainda); a GESTÃO é do Admin do
// Sistema. O rate limit público protege o formulário de abuso.
const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticate, optionalAuthenticate } = require('../middleware/auth');
const { requireRole, requirePermission } = require('../middleware/rbac');
const { SUPORTE } = require('../utils/adminAreas');
const { validate } = require('../utils/validate');
const { supplierDevSchema, supplierDevUpdateSchema, supplierDevApproveSchema } = require('../utils/schemas');
const svc = require('../services/supplierDevService');

const router = express.Router();

const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Demasiadas candidaturas. Tente novamente mais tarde.' } },
});

// --- Público -----------------------------------------------------------------
// Taxa de acesso ao programa, para o formulário a poder mostrar ANTES da
// submissão — é cobrada no acto de submeter a intenção.
router.get('/fee', (req, res) => {
  res.json(require('../services/planService').supplierDevAccessFee());
});

// Candidatura ao programa. Se houver sessão iniciada, associa à empresa.
router.post('/requests', publicLimiter, optionalAuthenticate, validate(supplierDevSchema), async (req, res) => {
  res.status(201).json(await svc.create(req.body, req.user?.companyId ?? null));
});

// Acompanhamento do estado por referência (sem conta).
router.get('/requests/:reference/track', async (req, res) => {
  res.json(await svc.trackByReference(req.params.reference));
});

// --- Admin do Sistema --------------------------------------------------------
router.get('/requests', authenticate, requireRole('ADMIN_SISTEMA'), requirePermission(SUPORTE), async (req, res) => {
  res.json(await svc.list({
    page: req.query.page, limit: req.query.limit, status: req.query.status, track: req.query.track, q: req.query.q,
  }));
});

router.patch('/requests/:id', authenticate, requireRole('ADMIN_SISTEMA'), requirePermission(SUPORTE), validate(supplierDevUpdateSchema), async (req, res) => {
  res.json(await svc.update(req.params.id, req.body, req.user));
});

// Aprova a candidatura: cria a empresa + a apólice Fornecedor→KIXIMA e
// convida o contacto a definir a senha (ver supplierDevService.approve).
router.patch('/requests/:id/approve', authenticate, requireRole('ADMIN_SISTEMA'), requirePermission(SUPORTE), validate(supplierDevApproveSchema), async (req, res) => {
  res.json(await svc.approve(req.params.id, req.body, req.user, `${req.protocol}://${req.get('host')}`));
});

module.exports = router;
