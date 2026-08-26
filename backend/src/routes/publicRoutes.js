// src/routes/publicRoutes.js
// Endpoints públicos, sem autenticação — informação que qualquer visitante
// da homepage já vê antes de ter conta.
const express = require('express');
const publicStatsService = require('../services/publicStatsService');
const feedbackService = require('../services/feedbackService');

const router = express.Router();

// Estatísticas agregadas da plataforma, para a home corporativa não mostrar
// números de marketing fixos onde há um número real.
router.get('/stats', async (req, res) => {
  res.json(await publicStatsService.resumo());
});

// Parede de avaliações da homepage — só leitura. A submissão exige sessão
// (ver routes/feedbackRoutes.js, POST /api/feedback) desde que a avaliação
// deixou de aceitar autoria anónima; aqui fica só a parte pública, o que já
// foi aprovado.
router.get('/feedback', async (req, res) => {
  res.json(await feedbackService.publicar());
});

module.exports = router;
