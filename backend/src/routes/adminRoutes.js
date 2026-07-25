// src/routes/adminRoutes.js
// Administração global — apenas o Admin do Sistema (Permissões e Gestão de
// Atividades de todo o sistema).
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const adminService = require('../services/adminService');

const router = express.Router();
router.use(authenticate);
router.use(requireRole('ADMIN_SISTEMA'));

router.get('/users', async (req, res) => res.json(await adminService.listUsers()));

router.patch('/users/:id/status', async (req, res) => {
  res.json(await adminService.setUserStatus({ id: req.params.id, active: req.body.active, actingUserId: req.user.id }));
});

router.get('/activities', async (req, res) => res.json(await adminService.systemActivities()));

module.exports = router;
