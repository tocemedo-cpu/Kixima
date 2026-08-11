// src/routes/companyAdminRoutes.js
// Telas do Company Admin (Dashboard, Organização, Atividades, Relatórios,
// Configurações). Exige a persona COMPANY_ADMIN.
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const svc = require('../services/companyAdminService');

const router = express.Router();
router.use(authenticate);

// Perfil da Empresa ("Organização") — a MESMA página serve o Company Admin e o
// Fornecedor (sempre a própria empresa, via req.user.companyId). Registada
// antes do guard exclusivo de COMPANY_ADMIN.
router.get('/organizacao', requireRole('COMPANY_ADMIN', 'FORNECEDOR'), async (req, res) => res.json(await svc.organizacao(req.user.companyId)));

router.use(requireRole('COMPANY_ADMIN'));

router.get('/dashboard', async (req, res) => res.json(await svc.dashboard(req.user.companyId)));
router.get('/activities', async (req, res) => res.json(await svc.activities(req.user.companyId, req.query.filter)));
router.get('/reports', async (req, res) => res.json(await svc.reports(req.user.companyId)));
router.get('/settings', async (req, res) => res.json(await svc.getSettings(req.user.companyId)));
router.put('/settings', async (req, res) => res.json(await svc.saveSettings(req.user.companyId, req.body)));

module.exports = router;
