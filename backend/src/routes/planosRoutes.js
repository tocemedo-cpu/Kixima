// src/routes/planosRoutes.js
// Tabela de planos e preços — PÚBLICA.
//
// Existe para a página de preços não ter os números escritos à mão. Uma tabela
// de preços que diverge do que a plataforma cobra é a pior espécie de bug:
// ninguém a testa, ninguém dá por ela, e quem descobre é o cliente que pagou
// um valor diferente do que leu.
const express = require('express');
const planService = require('../services/planService');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    planos: planService.tabela(),
    // Publicado junto: o que se paga por transação é a outra metade do modelo,
    // e omiti-lo faria a subscrição parecer o custo todo.
    taxaPorTransacao: {
      porOrdemUsd: Number(process.env.KIXIMA_FEE_PER_PO_USD) || 8,
      porFaturaUsd: Number(process.env.KIXIMA_FEE_PER_INVOICE_USD) || 15,
      limiarUsd: Number(process.env.KIXIMA_FEE_THRESHOLD_USD) || 11500,
      percentagemAcima: Number(process.env.KIXIMA_FEE_PERCENT_ABOVE) || 0.002,
    },
  });
});

module.exports = router;
