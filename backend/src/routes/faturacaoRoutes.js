// src/routes/faturacaoRoutes.js
// Faturação certificada: verificação de integridade e exportação SAF-T (AO).
//
// Só o Admin do Sistema. Não é uma restrição por precaução: o SAF-T contém a
// lista de clientes com NIF e os totais de todos os documentos do período — é o
// ficheiro mais sensível que a plataforma produz.
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const faturacaoService = require('../services/faturacaoService');
const saftService = require('../services/saftService');

const router = express.Router();
router.use(authenticate, requireRole('ADMIN_SISTEMA'));

// Estado da série e integridade da cadeia.
router.get('/integridade', async (req, res) => {
  const ano = Number(req.query.ano) || new Date().getFullYear();
  res.json(await faturacaoService.verificarCadeia(req.query.serie || null, ano));
});

// SAF-T (AO) do período. Devolve o XML como ficheiro.
router.get('/saft', async (req, res) => {
  const { xml, resumo } = await saftService.gerar({ de: req.query.de, ate: req.query.ate });
  // O resumo vai em cabeçalhos para quem descarrega poder confirmar o que
  // levou sem abrir o XML — em particular quantos documentos ficaram sem série
  // certificada, que é a pergunta que se faz depois.
  res.setHeader('X-Kixima-Documentos', String(resumo.documentos));
  res.setHeader('X-Kixima-Sem-Serie', String(resumo.semSerieCertificada));
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="SAFT-AO-${resumo.periodo.de}-a-${resumo.periodo.ate}.xml"`);
  res.send(xml);
});

// O mesmo, em JSON, para a interface mostrar antes de descarregar.
router.get('/saft/resumo', async (req, res) => {
  const { resumo } = await saftService.gerar({ de: req.query.de, ate: req.query.ate });
  res.json(resumo);
});

module.exports = router;
