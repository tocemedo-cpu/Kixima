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
const { ValidationError, ServiceUnavailableError, NotFoundError } = require('../utils/errors');
const { FATURACAO } = require('../utils/adminAreas');
const config = require('../config/env');
const logger = require('../config/logger');
const faturacaoService = require('../services/faturacaoService');
const saftService = require('../services/saftService');
const metricasService = require('../services/metricasService');
const agtPayloadService = require('../services/agtPayloadService');
const agtSeriesService = require('../services/agtSeriesService');
const agtSigningService = require('../services/agtSigningService');
const agtSandboxClient = require('../services/agtSandboxClient');

// agtPayloadService e agtSeriesService recusam-se a assinar sem a chave e o
// número de validação REAIS da AGT configurados (ver agtSigningService.js) —
// certo, mas sem este aviso explícito o pedido rebentava lá dentro com um
// Error genérico, que o errorHandler transformava num 500 sem contexto
// nenhum. Quem está a configurar o ambiente precisa de saber exatamente que
// falta isto, não só que "algo correu mal".
function exigirAssinaturaAgtConfigurada() {
  if (!agtSigningService.disponivel()) {
    const emFalta = agtSigningService.emFalta();
    throw new ServiceUnavailableError(
      'A assinatura AGT ainda não está configurada neste ambiente. Em falta: '
      + emFalta.join(', ')
      + '. Sem isso, nenhum documento pode ser assinado — contacte quem administra o ambiente.',
    );
  }
}

// Mesmo princípio, para a Sandbox REST (agtSandboxClient.js) — superset da
// assinatura (exige também AGT_SANDBOX_USERNAME/PASSWORD): usa-se em vez de
// exigirAssinaturaAgtConfigurada() nas rotas que SUBMETEM à AGT (não só
// assinam). agtSandboxClient.exigirConfiguracao() lança um Error genérico
// (cai num 500 sem contexto no errorHandler) — aqui dá-se o mesmo 503 com a
// lista do que falta, como nas outras rotas AGT desta ficheiro.
function exigirSandboxAgtConfigurada() {
  if (!agtSandboxClient.disponivel()) {
    const emFalta = agtSandboxClient.emFalta();
    throw new ServiceUnavailableError(
      'A ligação à Sandbox da AGT ainda não está configurada neste ambiente. Em falta: '
      + emFalta.join(', ')
      + '. Sem isso, nenhum pedido é submetido à AGT — contacte quem administra o ambiente.',
    );
  }
}

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
// para a conta de homologação/produção da AGT (o mesmo NIF de
// AGT_SANDBOX_USERNAME/PASSWORD, ver config/env.js), não uma ação por empresa
// fornecedora à escolha. Diferente do /agt-payload: esta rota SUBMETE mesmo o
// pedido à AGT (agtSeriesService.solicitarSerie(), que reaproveita
// agtSandboxClient.js) — por isso exige a configuração da Sandbox (superset
// da assinatura), não só a assinatura. Regime normal (N) é o único indicador
// de contingência usado neste ambiente; sem seletor porque não há outra
// opção real. establishmentNumber JÁ NÃO é um valor fixo no código — vem de
// config.agt.establishmentNumber (AGT_ESTABLISHMENT_NUMBER), a única fonte
// usada por todas as requisições AGT que precisam dele. Um "1" fixo aqui foi
// exatamente o que causou "E99 — O estabelecimento com o código 1 não se
// encontra registado para o contribuinte identificado pelo NIF ...": nunca
// tinha sido confirmado junto da AGT, só herdado do código.
router.get('/agt-serie-payload', requireRole('ADMIN_SISTEMA'), requirePermission(FATURACAO), async (req, res) => {
  exigirSandboxAgtConfigurada();
  if (!config.agt.taxRegistrationNumber) {
    throw new ServiceUnavailableError(
      'O NIF da conta AGT (AGT_NIF) ainda não está configurado neste ambiente — sem ele não se pode gerar um '
      + 'pedido de série. Contacte quem administra o ambiente.',
    );
  }
  if (!config.agt.establishmentNumber) {
    throw new ServiceUnavailableError(
      'O código do estabelecimento na AGT (AGT_ESTABLISHMENT_NUMBER) ainda não está configurado neste ambiente — '
      + 'sem ele não se pode gerar um pedido de série. Confirme o código correto junto da AGT para o NIF configurado '
      + '(AGT_NIF) antes de o definir; nunca um valor adivinhado por tentativa.',
    );
  }

  const { ano, tipoDocumento } = req.query;
  if (!ano || !Number.isInteger(Number(ano))) throw new ValidationError('Indique o ano da série (ano).');
  if (!tipoDocumento || !String(tipoDocumento).trim()) throw new ValidationError('Indique o tipo de documento (tipoDocumento).');

  logger.info('Solicitar Série: pedido recebido', { adminSistemaId: req.user.id, ano, tipoDocumento });

  res.json(await agtSeriesService.solicitarSerie({
    taxRegistrationNumber: config.agt.taxRegistrationNumber,
    seriesYear: Number(ano),
    documentType: String(tipoDocumento).trim().toUpperCase(),
    establishmentNumber: config.agt.establishmentNumber,
    seriesContingencyIndicator: 'N',
  }, { solicitadoPorId: req.user.id, solicitadoPorNome: req.user.name }));
});

// Histórico dos pedidos "Solicitar Série" já aceites pela AGT (tabela
// agtseriesfe) — o que a página mostra em vez do JSON bruto do último
// pedido: cada linha só existe porque a AGT aceitou um pedido feito na rota
// acima (seriesFEResult.seriesCode presente — ver
// agtSandboxClient.solicitarSerie(); resultCode NÃO é o sinal de sucesso
// aqui, a AGT devolve "1" mesmo quando aceita).
router.get('/agt-series-fe', requireRole('ADMIN_SISTEMA'), requirePermission(FATURACAO), async (req, res) => {
  res.json(await agtSeriesService.listarHistorico());
});

// Série ATUALMENTE atribuída pela AGT para um tipo de documento (FT, FR, NC,
// RC, ND, ...) — só consulta o histórico (agtSeriesFe), não gera nem
// submete nada. Usa-se antes de emitir um documento desse tipo, para saber
// que seriesCode entra no `documentNo` — nunca uma série fictícia inventada
// no código (ver o comentário no topo de agtSeriesService.js sobre
// "CERT-FR"). `ano`/`establishmentNumber` são opcionais na query — por
// omissão, o ano em curso e o estabelecimento configurado no ambiente
// (config.agt.establishmentNumber). 404 se nunca se pediu série nenhuma
// desse tipo/ano/estabelecimento.
router.get('/agt-serie/:tipo', requireRole('ADMIN_SISTEMA'), requirePermission(FATURACAO), async (req, res) => {
  const opcoes = {};
  if (req.query.ano) opcoes.ano = Number(req.query.ano);
  if (req.query.establishmentNumber) opcoes.establishmentNumber = req.query.establishmentNumber;
  const serie = await agtSeriesService.obterSeriePorTipo(req.params.tipo, opcoes);
  if (!serie) throw new NotFoundError('Série');
  res.json(serie);
});

// Métricas de negócio da plataforma inteira — só Admin do Sistema.
router.get('/metricas', requireRole('ADMIN_SISTEMA'), requirePermission(FATURACAO), async (req, res) => {
  res.json(await metricasService.resumo({ dias: req.query.dias }));
});

module.exports = router;
