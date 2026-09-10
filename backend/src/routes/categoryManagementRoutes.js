// src/routes/categoryManagementRoutes.js
// Category Management + Economia de Escala — PRO. O cliente vê onde está
// (volume atual), o que falta para o próximo desconto, e uma recomendação em
// texto (se a IA estiver configurada). O Admin do Sistema gere os patamares
// de desconto, que são configuráveis em runtime — ver discountThresholdService.js.
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole, requirePermission } = require('../middleware/rbac');
const { FINANCEIRO } = require('../utils/adminAreas');
const prisma = require('../config/database');
const planService = require('../services/planService');
const categoryAnalyticsService = require('../services/categoryAnalyticsService');
const discountThresholdService = require('../services/discountThresholdService');
const aiRecommendationService = require('../services/aiRecommendationService');
const auditService = require('../services/auditService');

const router = express.Router();
router.use(authenticate);

// --- Lado da empresa (compradora) -------------------------------------------

router.get('/analise', requireRole('COMPANY_ADMIN', 'COMPRADOR', 'FINANCEIRO'), async (req, res) => {
  const empresa = await prisma.company.findUnique({ where: { id: req.user.companyId } });
  planService.assertFeature(empresa, 'categoryManagement', 'Category Management');

  const meses = Number(req.query.meses) || 12;
  const volume = await categoryAnalyticsService.volumePorCategoria({ companyId: empresa.id, ...janelaMeses(meses) });
  const thresholds = await discountThresholdService.listar({ apenasAtivos: true });
  const thresholdInfo = await discountThresholdService.proximoThreshold(volume.total, thresholds);
  const oportunidades = await categoryAnalyticsService.oportunidadesConsolidacao({
    companyId: empresa.id, ...janelaMeses(meses), thresholds,
  });

  let recomendacao = { texto: null, motivo: 'Não pedida.' };
  if (req.query.recomendacao !== '0') {
    recomendacao = await aiRecommendationService.gerar({
      empresa: empresa.name,
      volumeAtual: volume.total,
      categorias: volume.categorias,
      thresholdInfo,
      oportunidades,
    });
  }

  res.json({
    periodo: volume.periodo,
    volumeAtualUsd: volume.total,
    categorias: volume.categorias,
    descontoAtual: thresholdInfo.descontoAtual,
    thresholdAtual: thresholdInfo.thresholdAtual,
    proximoThreshold: thresholdInfo.proximoThreshold,
    faltamUsd: thresholdInfo.faltamUsd,
    poupancaPotencialUsd: thresholdInfo.poupancaPotencialUsd,
    oportunidadesConsolidacao: oportunidades,
    recomendacao,
  });
});

// Média mensal de compra de um produto (também usada pelo PO Robot para
// propor a quantidade "calculada pela IA" — mesmo cálculo, um só lugar).
router.get('/produtos/:productId/media-mensal', requireRole('COMPANY_ADMIN', 'COMPRADOR', 'FINANCEIRO'), async (req, res) => {
  const empresa = await prisma.company.findUnique({ where: { id: req.user.companyId } });
  planService.assertFeature(empresa, 'categoryManagement', 'Category Management');
  res.json(await categoryAnalyticsService.mediaMensalPorProduto({ companyId: empresa.id, productId: req.params.productId }));
});

function janelaMeses(meses) {
  const ate = new Date();
  const de = new Date(ate);
  de.setMonth(de.getMonth() - meses);
  return { de, ate };
}

// --- Lado KIXIMA (Admin do Sistema): gestão dos patamares de desconto ------
// Mesma dupla de guarda das rotas ERP já existentes (companyRoutes.js) —
// configuração comercial sensível, não um recurso de cadastro qualquer.

router.get('/admin/thresholds', requireRole('ADMIN_SISTEMA'), requirePermission(FINANCEIRO), async (req, res) => {
  res.json(await discountThresholdService.listar());
});

router.post('/admin/thresholds', requireRole('ADMIN_SISTEMA'), requirePermission(FINANCEIRO), async (req, res) => {
  const threshold = await discountThresholdService.criar(req.body || {}, auditService.actorFrom(req));
  res.status(201).json(threshold);
});

router.put('/admin/thresholds/:id', requireRole('ADMIN_SISTEMA'), requirePermission(FINANCEIRO), async (req, res) => {
  res.json(await discountThresholdService.atualizar(req.params.id, req.body || {}, auditService.actorFrom(req)));
});

router.delete('/admin/thresholds/:id', requireRole('ADMIN_SISTEMA'), requirePermission(FINANCEIRO), async (req, res) => {
  await discountThresholdService.remover(req.params.id, auditService.actorFrom(req));
  res.status(204).send();
});

module.exports = router;
