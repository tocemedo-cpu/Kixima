// src/routes/buyerRoutes.js
// Endpoints de leitura das telas do Comprador. Todos exigem persona COMPRADOR
// (ou COMPANY_ADMIN, que partilha a mesma empresa compradora).
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const buyerService = require('../services/buyerService');

const router = express.Router();
router.use(authenticate);
router.use(requireRole('COMPRADOR', 'COMPANY_ADMIN'));

const asInt = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };

router.get('/orders', async (req, res) => {
  res.json(await buyerService.orders({
    buyerCompanyId: req.user.companyId, status: req.query.status, q: req.query.q,
    page: asInt(req.query.page, 1), limit: Math.min(50, asInt(req.query.limit, 10)),
  }));
});

router.get('/payments', async (req, res) => {
  res.json(await buyerService.payments({ buyerCompanyId: req.user.companyId, status: req.query.status, q: req.query.q }));
});

router.get('/deliveries', async (req, res) => {
  res.json(await buyerService.deliveries({ buyerCompanyId: req.user.companyId, stage: req.query.stage, q: req.query.q }));
});

router.get('/receptions', async (req, res) => {
  res.json(await buyerService.receptions({ buyerCompanyId: req.user.companyId, status: req.query.status, q: req.query.q }));
});

router.get('/suppliers', async (req, res) => {
  res.json(await buyerService.suppliers({ buyerCompanyId: req.user.companyId, status: req.query.status, q: req.query.q }));
});

router.get('/activities', async (req, res) => {
  res.json(await buyerService.activities({ buyerCompanyId: req.user.companyId, filter: req.query.filter }));
});

router.get('/profile', async (req, res) => {
  res.json(await buyerService.profile({ userId: req.user.id, companyId: req.user.companyId }));
});

module.exports = router;
