// src/routes/publicRoutes.js
// Endpoints públicos, sem autenticação — informação que qualquer visitante
// da homepage já vê antes de ter conta.
const express = require('express');
const publicStatsService = require('../services/publicStatsService');

const router = express.Router();

// Estatísticas agregadas da plataforma, para a home corporativa não mostrar
// números de marketing fixos onde há um número real.
router.get('/stats', async (req, res) => {
  res.json(await publicStatsService.resumo());
});

module.exports = router;
