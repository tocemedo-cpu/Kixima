// src/routes/feedbackRoutes.js
// Avaliações — submissão pelo utilizador autenticado (nunca anónima) e
// consulta das próprias, para qualquer persona com empresa (Comprador,
// Fornecedor, Company Admin, Financeiro…). A parede pública e a moderação do
// Admin do Sistema continuam noutros routers (publicRoutes.js / adminRoutes.js).
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { make } = require('../middleware/rateLimit');
const feedbackService = require('../services/feedbackService');

const router = express.Router();

router.use(authenticate);

const feedbackLimiter = make({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: { code: 'RATE_LIMITED', message: 'Demasiados envios. Tente novamente mais tarde.' } },
});

router.get('/opcoes', async (req, res) => {
  res.json(await feedbackService.opcoes({ companyId: req.user.companyId, userId: req.user.id }));
});

router.get('/minhas', async (req, res) => {
  res.json(await feedbackService.minhas({ userId: req.user.id }));
});

router.post('/', feedbackLimiter, async (req, res) => {
  const criado = await feedbackService.criar({
    userId: req.user.id,
    companyId: req.user.companyId,
    categoria: req.body.categoria,
    targetId: req.body.targetId,
    rating: req.body.rating,
    message: req.body.message,
  });
  res.status(201).json(criado);
});

module.exports = router;
