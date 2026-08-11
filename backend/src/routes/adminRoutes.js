// src/routes/adminRoutes.js
// Administração global — apenas o Admin do Sistema (Permissões e Gestão de
// Atividades de todo o sistema).
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const adminService = require('../services/adminService');
const auditService = require('../services/auditService');

const router = express.Router();
router.use(authenticate);
router.use(requireRole('ADMIN_SISTEMA'));

router.get('/users', async (req, res) => res.json(await adminService.listUsers()));

router.patch('/users/:id/status', async (req, res) => {
  const user = await adminService.setUserStatus({ id: req.params.id, active: req.body.active, actingUserId: req.user.id });
  await auditService.recordSafe({
    actor: auditService.actorFrom(req),
    action: user.active ? 'UTILIZADOR_DESBLOQUEADO' : 'UTILIZADOR_BLOQUEADO',
    entityType: 'User',
    entityId: user.id,
    entityRef: user.name,
    detail: { papel: user.role },
  });
  res.json(user);
});

router.get('/activities', async (req, res) => res.json(await adminService.systemActivities()));

// Livro de taxas da plataforma (KIXIMA).
router.get('/platform-fees', async (req, res) => res.json(await adminService.listPlatformFees()));
router.patch('/platform-fees/:id/charge', async (req, res) => {
  const fee = await adminService.chargePlatformFee(req.params.id);
  await auditService.recordSafe({
    actor: auditService.actorFrom(req),
    action: 'TAXA_COBRADA',
    entityType: 'PlatformFee',
    entityId: fee.id,
    entityRef: fee.reference || fee.id,
    detail: { valor: String(fee.amount), moeda: fee.currency || 'AOA' },
  });
  res.json(fee);
});

// Trilho de auditoria financeira (append-only) — consulta paginada/filtrável.
router.get('/audit-logs', async (req, res) => {
  res.json(await auditService.list({
    page: req.query.page, limit: req.query.limit, action: req.query.action, q: req.query.q,
  }));
});

module.exports = router;
