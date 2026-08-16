// src/routes/conciliacaoRoutes.js
// Conciliação do extrato bancário. Só o Financeiro e o Admin do Sistema.
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole, requirePermission } = require('../middleware/rbac');
const { FINANCEIRO } = require('../utils/adminAreas');
const conciliacao = require('../services/conciliacaoService');
const multicaixa = require('../services/multicaixaService');

const router = express.Router();
router.use(authenticate);

// Importa linhas do extrato e concilia o que casar.
router.post('/extrato', requireRole('FINANCEIRO', 'ADMIN_SISTEMA'), requirePermission(FINANCEIRO), async (req, res) => {
  const linhas = Array.isArray(req.body?.linhas) ? req.body.linhas : [];
  res.json(await conciliacao.importarExtrato(linhas, req.user));
});

// O que sobrou para uma pessoa resolver. Se esta lista só crescer, o formato
// da descrição do banco mudou e ninguém deu por isso.
router.get('/por-resolver', requireRole('FINANCEIRO', 'ADMIN_SISTEMA'), requirePermission(FINANCEIRO), async (req, res) => {
  res.json(await conciliacao.porResolver(req.query));
});

router.post('/:id/conciliar', requireRole('FINANCEIRO', 'ADMIN_SISTEMA'), requirePermission(FINANCEIRO), async (req, res) => {
  res.json(await conciliacao.reconciliarManualmente(req.params.id, req.body || {}, req.user));
});

// Estado dos canais automáticos, para não se descobrir que um não está ligado
// quando alguém carrega no botão.
router.get('/canais', requireRole('FINANCEIRO', 'ADMIN_SISTEMA'), requirePermission(FINANCEIRO), (req, res) => {
  res.json({
    canais: [
      { canal: 'TRANSFERENCIA_MANUAL', disponivel: true, nota: 'Comprovativo carregado e confirmado por uma pessoa.' },
      { canal: 'REFERENCIA_BANCARIA', disponivel: true, nota: 'Referência única por fatura, conciliada pelo extrato.' },
      multicaixa.estado(),
    ],
  });
});

module.exports = router;
