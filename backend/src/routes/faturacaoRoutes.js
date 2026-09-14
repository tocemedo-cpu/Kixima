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
const { ValidationError, NotFoundError, ServiceUnavailableError } = require('../utils/errors');
const { FATURACAO } = require('../utils/adminAreas');
const prisma = require('../config/database');
const faturacaoService = require('../services/faturacaoService');
const saftService = require('../services/saftService');
const metricasService = require('../services/metricasService');
const agtPayloadService = require('../services/agtPayloadService');
const agtSeriesService = require('../services/agtSeriesService');
const agtSigningService = require('../services/agtSigningService');

// agtPayloadService e agtSeriesService recusam-se a assinar sem a chave e o
// número de validação REAIS da AGT configurados (ver agtSigningService.js) —
// certo, mas sem este aviso explícito o pedido rebentava lá dentro com um
// Error genérico, que o errorHandler transformava num 500 sem contexto
// nenhum. Quem está a configurar o ambiente precisa de saber exatamente que
// falta isto, não só que "algo correu mal".
function exigirAssinaturaAgtConfigurada() {
  if (!agtSigningService.disponivel()) {
    throw new ServiceUnavailableError(
      'A assinatura AGT ainda não está configurada neste ambiente (falta a chave privada e/ou o número de '
      + 'validação). Sem isso, nenhum documento pode ser assinado — contacte quem administra o ambiente.',
    );
  }
}

const INDICADORES_CONTINGENCIA = ['N', 'C'];

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

// Payload de submissão AGT (e-Fatura, schema v1.2) — FT (fatura), NC (nota de
// crédito) ou RC (recibo). Mesma posse que o SAF-T: o Fornecedor só pede o
// payload dos SEUS documentos; o Admin do Sistema tem de indicar de qual
// empresa. Devolve o JSON já assinado (ver agtPayloadService.js) — não
// submete a nada, só gera e assina.
router.get(
  '/agt-payload/:tipo/:id',
  requireRole('FORNECEDOR', 'COMPANY_ADMIN', 'ADMIN_SISTEMA'),
  requirePermission(FATURACAO),
  async (req, res) => {
    exigirAssinaturaAgtConfigurada();
    const supplierCompanyId = resolverEmpresaFornecedora(req);
    res.json(await agtPayloadService.construirPayload(req.params.tipo.toUpperCase(), req.params.id, supplierCompanyId));
  },
);

// Pedido de série de numeração à AGT ("Solicitar Série", DS.120, 4.5) — só o
// Admin do Sistema, área Faturação: é um passo de configuração/pré-requisito
// (a empresa precisa de uma série atribuída pela AGT antes de poder emitir
// documentos fiscais com ela), não uma ação do dia a dia de uma empresa
// fornecedora. Mesmo princípio do /agt-payload: só gera e assina o pedido —
// não há cliente de rede aqui, quem submete é quem tem acesso à conta de
// homologação/produção da AGT.
router.get('/agt-serie-payload', requireRole('ADMIN_SISTEMA'), requirePermission(FATURACAO), async (req, res) => {
  exigirAssinaturaAgtConfigurada();
  const { supplierCompanyId, ano, tipoDocumento, numeroEstabelecimento } = req.query;
  const indicadorContingencia = req.query.indicadorContingencia || 'N';

  if (!supplierCompanyId) throw new ValidationError('Indique a empresa fornecedora (supplierCompanyId).');
  if (!ano || !Number.isInteger(Number(ano))) throw new ValidationError('Indique o ano da série (ano).');
  if (!tipoDocumento || !String(tipoDocumento).trim()) throw new ValidationError('Indique o tipo de documento (tipoDocumento).');
  if (!numeroEstabelecimento || !String(numeroEstabelecimento).trim()) {
    throw new ValidationError('Indique o número do estabelecimento (numeroEstabelecimento).');
  }
  if (!INDICADORES_CONTINGENCIA.includes(indicadorContingencia)) {
    throw new ValidationError('indicadorContingencia tem de ser "N" (regime normal) ou "C" (contingência).');
  }

  const empresa = await prisma.company.findUnique({ where: { id: supplierCompanyId }, select: { taxId: true } });
  if (!empresa) throw new NotFoundError('Empresa fornecedora');

  res.json(agtSeriesService.construirPedidoSerie({
    taxRegistrationNumber: empresa.taxId,
    seriesYear: Number(ano),
    documentType: String(tipoDocumento).trim().toUpperCase(),
    establishmentNumber: String(numeroEstabelecimento).trim(),
    seriesContingencyIndicator: indicadorContingencia,
  }));
});

// Métricas de negócio da plataforma inteira — só Admin do Sistema.
router.get('/metricas', requireRole('ADMIN_SISTEMA'), requirePermission(FATURACAO), async (req, res) => {
  res.json(await metricasService.resumo({ dias: req.query.dias }));
});

module.exports = router;
