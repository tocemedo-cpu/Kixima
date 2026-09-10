// src/routes/addonRoutes.js
// Add-ons pagos (hoje só o Automatic PO Robot): a empresa pede e paga, a
// KIXIMA confirma — mesma separação de assinaturaRoutes.js, mesmos guards.
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole, requirePermission } = require('../middleware/rbac');
const { FINANCEIRO } = require('../utils/adminAreas');
const { uploadDocuments } = require('../config/upload');
const auditService = require('../services/auditService');
const svc = require('../services/addonService');

const router = express.Router();
router.use(authenticate);

// Catálogo de add-ons disponíveis (preço, plano exigido) — qualquer
// utilizador autenticado pode ver o que existe para pedir.
router.get('/catalogo', async (req, res) => {
  res.json(svc.catalogo());
});

// --- Lado KIXIMA -------------------------------------------------------------
router.get('/fila', requireRole('ADMIN_SISTEMA'), requirePermission(FINANCEIRO), async (req, res) => {
  res.json(await svc.fila());
});

router.post('/:id/confirmar', requireRole('ADMIN_SISTEMA'), requirePermission(FINANCEIRO), async (req, res) => {
  res.json(await svc.confirmar(req.params.id, req.user.id, { notas: req.body?.notas }, auditService.actorFrom(req)));
});

// --- Lado da empresa ---------------------------------------------------------
router.get('/:addonKey/estado', requireRole('COMPANY_ADMIN', 'FINANCEIRO', 'COMPRADOR'), async (req, res) => {
  res.json(await svc.estado(req.user.companyId, req.params.addonKey));
});

router.post('/:addonKey/pedir', requireRole('COMPANY_ADMIN'), async (req, res) => {
  const cobranca = await svc.pedir(req.user.companyId, req.params.addonKey, req.user.id, auditService.actorFrom(req));
  res.status(201).json(cobranca);
});

router.post(
  '/:id/comprovativo',
  requireRole('COMPANY_ADMIN', 'FINANCEIRO'),
  uploadDocuments.single('comprovativo'),
  async (req, res) => {
    res.json(await svc.submeterComprovativo(
      req.user.companyId, req.params.id, req.file, auditService.actorFrom(req),
    ));
  },
);

// Cancelar. O Admin do Sistema cancela qualquer uma; a empresa só as suas.
router.post('/:id/cancelar', requireRole('COMPANY_ADMIN', 'ADMIN_SISTEMA'), requirePermission(FINANCEIRO), async (req, res) => {
  const escopo = req.user.role === 'ADMIN_SISTEMA' ? {} : { companyId: req.user.companyId };
  res.json(await svc.cancelar(req.params.id, { motivo: req.body?.motivo, ...escopo }, auditService.actorFrom(req)));
});

module.exports = router;
