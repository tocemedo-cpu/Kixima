// src/services/discountThresholdService.js
// CRUD dos patamares de desconto por economia de escala — CONFIGURÁVEL EM
// RUNTIME (pedido explícito): os valores 2,5%/5%/10% do pedido original são
// só o SEED inicial (ver migração 20260915000000_discount_thresholds), não
// uma constante no código. Um Admin do Sistema pode mudá-los sem deploy.
const prisma = require('../config/database');
const { NotFoundError, ValidationError } = require('../utils/errors');
const auditService = require('./auditService');

async function listar({ apenasAtivos = false } = {}) {
  return prisma.discountThreshold.findMany({
    where: apenasAtivos ? { ativo: true } : undefined,
    orderBy: { minVolumeUsd: 'asc' },
  });
}

async function criar({ minVolumeUsd, discountPercent, ativo = true }, actor) {
  if (!(Number(minVolumeUsd) > 0)) throw new ValidationError('minVolumeUsd tem de ser maior que zero.');
  if (!(Number(discountPercent) > 0 && Number(discountPercent) <= 100)) {
    throw new ValidationError('discountPercent tem de estar entre 0 e 100.');
  }

  const threshold = await prisma.discountThreshold.create({
    data: { minVolumeUsd, discountPercent, ativo },
  });
  await auditService.recordSafe({
    actor,
    action: 'DISCOUNT_THRESHOLD_CRIADO',
    entityType: 'DiscountThreshold',
    entityId: threshold.id,
    detail: { minVolumeUsd: String(minVolumeUsd), discountPercent: String(discountPercent), ativo },
  });
  return threshold;
}

async function atualizar(id, { minVolumeUsd, discountPercent, ativo }, actor) {
  const existente = await prisma.discountThreshold.findUnique({ where: { id } });
  if (!existente) throw new NotFoundError('Patamar de desconto');

  if (minVolumeUsd != null && !(Number(minVolumeUsd) > 0)) {
    throw new ValidationError('minVolumeUsd tem de ser maior que zero.');
  }
  if (discountPercent != null && !(Number(discountPercent) > 0 && Number(discountPercent) <= 100)) {
    throw new ValidationError('discountPercent tem de estar entre 0 e 100.');
  }

  const data = {};
  if (minVolumeUsd != null) data.minVolumeUsd = minVolumeUsd;
  if (discountPercent != null) data.discountPercent = discountPercent;
  if (ativo != null) data.ativo = ativo;

  const threshold = await prisma.discountThreshold.update({ where: { id }, data });
  await auditService.recordSafe({
    actor,
    action: 'DISCOUNT_THRESHOLD_ATUALIZADO',
    entityType: 'DiscountThreshold',
    entityId: threshold.id,
    detail: { antes: { minVolumeUsd: String(existente.minVolumeUsd), discountPercent: String(existente.discountPercent), ativo: existente.ativo }, depois: data },
  });
  return threshold;
}

async function remover(id, actor) {
  const existente = await prisma.discountThreshold.findUnique({ where: { id } });
  if (!existente) throw new NotFoundError('Patamar de desconto');
  await prisma.discountThreshold.delete({ where: { id } });
  await auditService.recordSafe({
    actor,
    action: 'DISCOUNT_THRESHOLD_REMOVIDO',
    entityType: 'DiscountThreshold',
    entityId: id,
    detail: { minVolumeUsd: String(existente.minVolumeUsd), discountPercent: String(existente.discountPercent) },
  });
}

/**
 * O patamar aplicável ao volume atual (o maior threshold ativo já
 * atingido) e o próximo por atingir — a resposta de que o cliente precisa:
 * "onde estou" e "o que falta". `patamares` pode ser passado já carregado
 * (evita reconsultar a base quando quem chama já tem a lista).
 */
async function proximoThreshold(volumeAtualUsd, patamares) {
  const lista = (patamares || (await listar({ apenasAtivos: true })))
    .map((t) => ({ ...t, minVolumeUsd: Number(t.minVolumeUsd), discountPercent: Number(t.discountPercent) }))
    .sort((a, b) => a.minVolumeUsd - b.minVolumeUsd);

  const volume = Number(volumeAtualUsd) || 0;
  const atingidos = lista.filter((t) => t.minVolumeUsd <= volume);
  const atual = atingidos.length ? atingidos[atingidos.length - 1] : null;
  const proximo = lista.find((t) => t.minVolumeUsd > volume) || null;

  const descontoAtual = atual ? atual.discountPercent : 0;
  // Poupança ADICIONAL de cruzar o próximo patamar: a diferença de desconto
  // aplicada ao volume que esse patamar exige — não o desconto todo (isso
  // incluiria o que já se pouparia hoje, se já houver um patamar atingido).
  const poupancaPotencialUsd = proximo
    ? Math.round(proximo.minVolumeUsd * ((proximo.discountPercent - descontoAtual) / 100) * 100) / 100
    : null;

  return {
    volumeAtualUsd: volume,
    descontoAtual,
    thresholdAtual: atual,
    proximoThreshold: proximo,
    faltamUsd: proximo ? Math.round((proximo.minVolumeUsd - volume) * 100) / 100 : null,
    poupancaPotencialUsd,
  };
}

module.exports = { listar, criar, atualizar, remover, proximoThreshold };
