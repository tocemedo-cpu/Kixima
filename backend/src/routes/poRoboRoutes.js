// src/routes/poRoboRoutes.js
// Automatic PO Robot (add-on PRO): o Company Admin configura as regras (por
// produto, periodicidade, média aceite da IA ou definida à mão, limite de
// segurança). Todas as rotas exigem o add-on ATIVO — addonService.assertAddon
// nunca deixa passar sem ele, mesmo que alguém tente ir direto ao endpoint.
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const prisma = require('../config/database');
const addonService = require('../services/addonService');
const categoryAnalyticsService = require('../services/categoryAnalyticsService');
const poRoboService = require('../services/poRoboService');
const auditService = require('../services/auditService');
const { NotFoundError, ValidationError } = require('../utils/errors');

const ADDON_KEY = 'PO_ROBOT';
const PERIODICIDADES = ['SEMANAL', 'QUINZENAL', 'MENSAL'];
const MEDIA_ORIGENS = ['IA', 'MANUAL'];

const router = express.Router();
router.use(authenticate, requireRole('COMPANY_ADMIN'));

router.get('/regras', async (req, res) => {
  const regras = await prisma.poRoboRegra.findMany({
    where: { companyId: req.user.companyId },
    include: { product: { select: { id: true, name: true, sku: true, unitPrice: true, currency: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(regras);
});

// Média mensal sugerida pela IA para um produto — o cliente vê isto antes de
// decidir "aceitar a média calculada" ou definir a sua própria.
router.get('/media-sugerida/:productId', async (req, res) => {
  await addonService.assertAddon(req.user.companyId, ADDON_KEY);
  res.json(await categoryAnalyticsService.mediaMensalPorProduto({
    companyId: req.user.companyId, productId: req.params.productId,
  }));
});

function validarCorpo(body) {
  const { productId, mediaOrigem, mediaMensal, periodicidade, quantidade, limiteMaximoUsd } = body || {};
  if (!productId) throw new ValidationError('Indique o produto.');
  if (!MEDIA_ORIGENS.includes(mediaOrigem)) {
    throw new ValidationError(`mediaOrigem inválida — use ${MEDIA_ORIGENS.join(' ou ')}.`);
  }
  if (!(Number(mediaMensal) > 0)) {
    throw new ValidationError('mediaMensal tem de ser maior que zero.');
  }
  if (!PERIODICIDADES.includes(periodicidade)) {
    throw new ValidationError(`periodicidade inválida — use ${PERIODICIDADES.join(', ')}.`);
  }
  if (quantidade != null && !(Number.isInteger(Number(quantidade)) && Number(quantidade) > 0)) {
    throw new ValidationError('quantidade tem de ser um número inteiro maior que zero.');
  }
  if (limiteMaximoUsd != null && !(Number(limiteMaximoUsd) > 0)) {
    throw new ValidationError('limiteMaximoUsd tem de ser maior que zero.');
  }
  return {
    productId,
    mediaOrigem,
    mediaMensal: Number(mediaMensal),
    periodicidade,
    quantidade: quantidade != null ? Number(quantidade) : null,
    limiteMaximoUsd: limiteMaximoUsd != null ? Number(limiteMaximoUsd) : null,
  };
}

router.post('/regras', async (req, res) => {
  await addonService.assertAddon(req.user.companyId, ADDON_KEY);
  const dados = validarCorpo(req.body);

  const produto = await prisma.product.findUnique({ where: { id: dados.productId } });
  if (!produto) throw new NotFoundError('Produto');

  const regra = await prisma.poRoboRegra.create({
    data: {
      companyId: req.user.companyId,
      productId: dados.productId,
      mediaOrigem: dados.mediaOrigem,
      mediaMensal: dados.mediaMensal,
      periodicidade: dados.periodicidade,
      quantidade: dados.quantidade,
      limiteMaximoUsd: dados.limiteMaximoUsd,
      // Elegível já na próxima corrida do job — a periodicidade rege o
      // INTERVALO entre execuções, não um atraso antes da primeira.
      proximaExecucaoEm: new Date(),
    },
  });

  await auditService.recordSafe({
    actor: auditService.actorFrom(req),
    action: 'PO_ROBO_REGRA_CRIADA',
    entityType: 'PoRoboRegra',
    entityId: regra.id,
    detail: { produto: produto.name, ...dados },
  });

  res.status(201).json(regra);
});

router.put('/regras/:id', async (req, res) => {
  await addonService.assertAddon(req.user.companyId, ADDON_KEY);
  const existente = await prisma.poRoboRegra.findUnique({ where: { id: req.params.id } });
  if (!existente || existente.companyId !== req.user.companyId) throw new NotFoundError('Regra');

  const data = {};
  if (req.body?.ativo != null) data.ativo = Boolean(req.body.ativo);
  if (req.body?.mediaOrigem != null || req.body?.mediaMensal != null || req.body?.periodicidade != null
    || req.body?.quantidade !== undefined || req.body?.limiteMaximoUsd !== undefined) {
    const validado = validarCorpo({
      productId: existente.productId,
      mediaOrigem: req.body?.mediaOrigem ?? existente.mediaOrigem,
      mediaMensal: req.body?.mediaMensal ?? existente.mediaMensal,
      periodicidade: req.body?.periodicidade ?? existente.periodicidade,
      quantidade: req.body?.quantidade !== undefined ? req.body.quantidade : existente.quantidade,
      limiteMaximoUsd: req.body?.limiteMaximoUsd !== undefined ? req.body.limiteMaximoUsd : existente.limiteMaximoUsd,
    });
    Object.assign(data, {
      mediaOrigem: validado.mediaOrigem,
      mediaMensal: validado.mediaMensal,
      periodicidade: validado.periodicidade,
      quantidade: validado.quantidade,
      limiteMaximoUsd: validado.limiteMaximoUsd,
    });
  }

  const regra = await prisma.poRoboRegra.update({ where: { id: existente.id }, data });

  await auditService.recordSafe({
    actor: auditService.actorFrom(req),
    action: 'PO_ROBO_REGRA_ATUALIZADA',
    entityType: 'PoRoboRegra',
    entityId: regra.id,
    detail: data,
  });

  res.json(regra);
});

router.delete('/regras/:id', async (req, res) => {
  const existente = await prisma.poRoboRegra.findUnique({ where: { id: req.params.id } });
  if (!existente || existente.companyId !== req.user.companyId) throw new NotFoundError('Regra');

  await prisma.poRoboRegra.delete({ where: { id: existente.id } });

  await auditService.recordSafe({
    actor: auditService.actorFrom(req),
    action: 'PO_ROBO_REGRA_REMOVIDA',
    entityType: 'PoRoboRegra',
    entityId: existente.id,
  });

  res.status(204).send();
});

module.exports = router;
