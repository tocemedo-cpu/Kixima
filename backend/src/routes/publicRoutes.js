// src/routes/publicRoutes.js
// Endpoints públicos, sem autenticação — informação que qualquer visitante
// da homepage já vê antes de ter conta.
const express = require('express');
const { make } = require('../middleware/rateLimit');
const publicStatsService = require('../services/publicStatsService');
const feedbackService = require('../services/feedbackService');

const router = express.Router();

// Estatísticas agregadas da plataforma, para a home corporativa não mostrar
// números de marketing fixos onde há um número real.
router.get('/stats', async (req, res) => {
  res.json(await publicStatsService.resumo());
});

// Avaliações públicas ("Avaliações" na home) — o limite protege o formulário
// aberto (sem conta, sem sessão) de abuso, tal como a candidatura ao Supplier
// Development. Desligado em teste (make()), como o resto dos limitadores.
const feedbackLimiter = make({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: { code: 'RATE_LIMITED', message: 'Demasiados envios. Tente novamente mais tarde.' } },
});

router.get('/feedback', async (req, res) => {
  res.json(await feedbackService.publicar());
});

router.post('/feedback', feedbackLimiter, async (req, res) => {
  res.status(201).json(await feedbackService.criar(req.body));
});

module.exports = router;
