const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const reportsService = require('../services/reportsService');
const conteudoLocalService = require('../services/conteudoLocalService');
const planService = require('../services/planService');
const prisma = require('../config/database');

const router = express.Router();

router.use(authenticate);

// Estatísticas do fornecedor (catálogo, ordens, receita, mais vendidos).
// `meses` é opcional: sem ele vale a janela do plano. Com ele, vale o menor
// dos dois — pedir menos histórico é sempre legítimo.
router.get('/fornecedor', requireRole('FORNECEDOR', 'COMPANY_ADMIN'), async (req, res) => {
  const stats = await reportsService.supplierStats(req.user.companyId, { meses: req.query.meses });
  res.json(stats);
});

// Relatório de conteúdo local — quem compra (operadora) é que reporta.
//
// Não existe modelo oficial da ANPG; este é um desenho proposto. Está no plano
// Pro porque é uma obrigação regulatória penosa transformada num clique — é o
// valor que uma operadora reconhece de imediato.
router.get('/conteudo-local', requireRole('COMPANY_ADMIN', 'COMPRADOR', 'FINANCEIRO'), async (req, res) => {
  const empresa = await prisma.company.findUnique({ where: { id: req.user.companyId } });
  planService.assertFeature(empresa, 'relatorioConteudoLocal', 'Relatório de conteúdo local');
  res.json(await conteudoLocalService.gerar(req.user.companyId, { de: req.query.de, ate: req.query.ate }));
});

module.exports = router;
