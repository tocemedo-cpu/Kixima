// src/routes/faturacaoRoutes.js
// Faturação certificada: verificação de integridade e exportação SAF-T (AO).
//
// O SAF-T é SEMPRE de UMA empresa fornecedora — é ela o emitente fiscal dos
// seus documentos (a KIXIMA nunca compra para revender, só garante o
// pagamento). Por isso o Fornecedor (ou o Company Admin do lado fornecedor)
// pode pedir o SAF-T da SUA PRÓPRIA empresa, sem precisar do Admin do
// Sistema — é a própria empresa que responde por ele perante a AGT.
// Integridade/métricas continuam só do Admin do Sistema: são vistas sobre a
// plataforma inteira, não sobre uma única empresa.
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole, requirePermission } = require('../middleware/rbac');
const { ValidationError } = require('../utils/errors');
const { FATURACAO } = require('../utils/adminAreas');
const faturacaoService = require('../services/faturacaoService');
const saftService = require('../services/saftService');
const metricasService = require('../services/metricasService');

const router = express.Router();
router.use(authenticate);

// O Fornecedor só pode pedir o SAF-T da SUA empresa; o Admin do Sistema tem
// de indicar de qual (não há "SAF-T de todos" — o ficheiro é sempre de uma
// só empresa, ver saftService.js).
function resolverEmpresaFornecedora(req) {
  if (req.user.role === 'ADMIN_SISTEMA') {
    if (!req.query.supplierCompanyId) {
      throw new ValidationError('Indique a empresa fornecedora (supplierCompanyId).');
    }
    return req.query.supplierCompanyId;
  }
  return req.user.companyId;
}

// Estado da série e integridade da cadeia — visão de plataforma, só Admin do Sistema.
router.get('/integridade', requireRole('ADMIN_SISTEMA'), requirePermission(FATURACAO), async (req, res) => {
  const ano = Number(req.query.ano) || new Date().getFullYear();
  res.json(await faturacaoService.verificarCadeia(req.query.serie || null, ano));
});

// SAF-T (AO) do período, da empresa fornecedora. Devolve o XML como ficheiro.
router.get(
  '/saft',
  requireRole('FORNECEDOR', 'COMPANY_ADMIN', 'ADMIN_SISTEMA'),
  requirePermission(FATURACAO),
  async (req, res) => {
    const supplierCompanyId = resolverEmpresaFornecedora(req);
    const { xml, resumo } = await saftService.gerar({ de: req.query.de, ate: req.query.ate, supplierCompanyId });
    // O resumo vai em cabeçalhos para quem descarrega poder confirmar o que
    // levou sem abrir o XML — em particular quantos documentos ficaram sem série
    // certificada, que é a pergunta que se faz depois.
    res.setHeader('X-Kixima-Documentos', String(resumo.documentos));
    res.setHeader('X-Kixima-Sem-Serie', String(resumo.semSerieCertificada));
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="SAFT-AO-${resumo.periodo.de}-a-${resumo.periodo.ate}.xml"`);
    res.send(xml);
  },
);

// O mesmo, em JSON, para a interface mostrar antes de descarregar.
router.get(
  '/saft/resumo',
  requireRole('FORNECEDOR', 'COMPANY_ADMIN', 'ADMIN_SISTEMA'),
  requirePermission(FATURACAO),
  async (req, res) => {
    const supplierCompanyId = resolverEmpresaFornecedora(req);
    const { resumo } = await saftService.gerar({ de: req.query.de, ate: req.query.ate, supplierCompanyId });
    res.json(resumo);
  },
);

// Métricas de negócio da plataforma inteira — só Admin do Sistema.
router.get('/metricas', requireRole('ADMIN_SISTEMA'), requirePermission(FATURACAO), async (req, res) => {
  res.json(await metricasService.resumo({ dias: req.query.dias }));
});

module.exports = router;
