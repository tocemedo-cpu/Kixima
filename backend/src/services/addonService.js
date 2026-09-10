// src/services/addonService.js
// Add-ons pagos, à parte do plano — mesmo mecanismo de PlanoCobranca/
// assinaturaService.js (pedir → comprovativo → confirmar por um humano da
// KIXIMA), aplicado a CompanyAddon/AddonCobranca. O primeiro add-on é o
// Automatic PO Robot.
//
// AS MESMAS DUAS REGRAS DE assinaturaService.js:
//   1. O ADD-ON SÓ ATIVA NA CONFIRMAÇÃO — pedir não liga nada.
//   2. O PREÇO CONGELA NO PEDIDO — a cobrança guarda o que foi acordado.
const prisma = require('../config/database');
const planService = require('./planService');
const storageService = require('./storageService');
const auditService = require('./auditService');
const notificationService = require('./notificationService');
const { nextReference } = require('../utils/reference');
const {
  NotFoundError, ForbiddenError, ValidationError, ConflictError, BusinessRuleError,
} = require('../utils/errors');

const EM_ABERTO = ['PENDENTE', 'COMPROVATIVO_ENVIADO'];
const MESES_DO_PERIODO = { MENSAL: 1, TRIMESTRAL: 3, SEMESTRAL: 6, ANUAL: 12 };

// Add-ons disponíveis. Preço configurável por ambiente — nunca um valor
// final hardcoded no código, mesma regra de planService.PRECOS.
const ADDONS = {
  PO_ROBOT: {
    label: 'Automatic PO Robot',
    requerPlano: 'PRO',
    valorUsd: Number(process.env.KIXIMA_PRECO_ADDON_PO_ROBOT_USD) || 200,
    periodo: process.env.KIXIMA_PRECO_ADDON_PO_ROBOT_PERIODO || 'MENSAL',
  },
};

function definicao(addonKey) {
  const def = ADDONS[addonKey];
  if (!def) throw new ValidationError(`Add-on desconhecido: "${addonKey}". Os add-ons são: ${Object.keys(ADDONS).join(', ')}.`);
  return def;
}

function precoDe(addonKey) {
  const def = definicao(addonKey);
  const meses = MESES_DO_PERIODO[def.periodo] || 1;
  return { valorUsd: def.valorUsd, periodo: def.periodo, meses, porMesUsd: Math.round((def.valorUsd / meses) * 100) / 100 };
}

function planSuficiente(plano, minimo) {
  const escada = planService.ESCADA;
  return escada.indexOf(planService.normalizarPlano(plano)) >= escada.indexOf(minimo);
}

// Catálogo para a interface (preço + se exige upgrade de plano primeiro).
function catalogo() {
  return Object.entries(ADDONS).map(([addonKey, def]) => ({ addonKey, label: def.label, requerPlano: def.requerPlano, preco: precoDe(addonKey) }));
}

async function estado(companyId, addonKey) {
  const def = definicao(addonKey);
  const [addon, emAberto] = await Promise.all([
    prisma.companyAddon.findUnique({ where: { companyId_addonKey: { companyId, addonKey } } }),
    prisma.addonCobranca.findFirst({
      where: { companyId, addonKey, status: { in: EM_ABERTO } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  return {
    addonKey,
    label: def.label,
    preco: precoDe(addonKey),
    ativo: addon?.status === 'ATIVO',
    activatedAt: addon?.activatedAt || null,
    emAberto,
  };
}

/**
 * Guarda: lança se o add-on não estiver ATIVO para esta empresa. Mesmo
 * molde de planService.assertFeature — usada por poRoboRoutes.js antes de
 * qualquer operação do robot.
 */
async function assertAddon(companyId, addonKey, label) {
  const def = definicao(addonKey);
  const addon = await prisma.companyAddon.findUnique({ where: { companyId_addonKey: { companyId, addonKey } } });
  if (addon?.status !== 'ATIVO') {
    throw new BusinessRuleError(
      `"${label || def.label}" é um add-on pago (${def.valorUsd} USD/${def.periodo.toLowerCase()}) `
      + 'e ainda não está ativo para esta empresa.',
    );
  }
}

async function pedir(companyId, addonKey, userId, actor = null) {
  const def = definicao(addonKey);
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new NotFoundError('Empresa');
  if (company.status !== 'APROVADA') {
    throw new BusinessRuleError('A empresa tem de estar aprovada para pedir um add-on.');
  }
  if (def.requerPlano && !planSuficiente(company.plan, def.requerPlano)) {
    throw new BusinessRuleError(`"${def.label}" exige o plano ${def.requerPlano} ou superior.`);
  }

  const jaAtivo = await prisma.companyAddon.findUnique({ where: { companyId_addonKey: { companyId, addonKey } } });
  if (jaAtivo?.status === 'ATIVO') {
    throw new ConflictError(`O add-on "${def.label}" já está ativo para esta empresa.`);
  }

  const aberta = await prisma.addonCobranca.findFirst({ where: { companyId, addonKey, status: { in: EM_ABERTO } } });
  if (aberta) {
    throw new ConflictError(
      `Já existe a cobrança ${aberta.referencia} do add-on "${def.label}" por liquidar (${aberta.valorUsd} USD). `
      + 'Conclua ou cancele essa antes de pedir outra.',
    );
  }

  const preco = precoDe(addonKey);
  const referencia = await nextReference('ADD', 'addonCobranca', 'referencia');

  const cobranca = await prisma.addonCobranca.create({
    data: {
      referencia,
      companyId,
      addonKey,
      valorUsd: preco.valorUsd,
      periodo: preco.periodo,
      meses: preco.meses,
      createdById: userId || null,
    },
  });

  await auditService.recordSafe({
    actor: actor || { actorId: userId },
    action: 'ADDON_PEDIDO',
    entityType: 'AddonCobranca',
    entityId: cobranca.id,
    entityRef: referencia,
    detail: { addonKey, label: def.label, valorUsd: String(preco.valorUsd), periodo: preco.periodo },
  });

  return cobranca;
}

/** Carrega o comprovativo da transferência. Obrigatório, mesma regra de assinaturaService. */
async function submeterComprovativo(companyId, cobrancaId, file, actor = null) {
  if (!file) {
    throw new ValidationError('Anexe o comprovativo da transferência (PDF ou imagem) para submeter o pagamento.');
  }

  const cobranca = await prisma.addonCobranca.findUnique({ where: { id: cobrancaId } });
  if (!cobranca) throw new NotFoundError('Cobrança');
  if (cobranca.companyId !== companyId) {
    throw new ForbiddenError('Só pode pagar cobranças da sua própria empresa.');
  }
  if (!EM_ABERTO.includes(cobranca.status)) {
    throw new ConflictError(`A cobrança ${cobranca.referencia} está ${cobranca.status.toLowerCase()} e não aceita comprovativo.`);
  }

  const comprovativoUrl = await storageService.saveFile({
    buffer: file.buffer,
    originalname: file.originalname,
    mimetype: file.mimetype,
    keyHint: `addon-${cobranca.referencia}`,
    folder: 'proofs',
  });

  const atualizada = await prisma.addonCobranca.update({
    where: { id: cobrancaId },
    data: { comprovativoUrl, status: 'COMPROVATIVO_ENVIADO', submetidoEm: new Date() },
  });

  await auditService.recordSafe({
    actor: actor || {},
    action: 'ADDON_COMPROVATIVO_ENVIADO',
    entityType: 'AddonCobranca',
    entityId: cobranca.id,
    entityRef: cobranca.referencia,
    detail: { addonKey: cobranca.addonKey, comprovativo: file.originalname || 'comprovativo', valorUsd: String(cobranca.valorUsd) },
  });

  notificationService.notifyUsersByRole({
    roles: ['ADMIN_SISTEMA'],
    type: 'SUBSCRICAO_COMPROVATIVO',
    title: 'Comprovativo de add-on recebido',
    message: `${cobranca.referencia}: comprovativo carregado para o add-on ${ADDONS[cobranca.addonKey]?.label || cobranca.addonKey} `
      + `(${cobranca.valorUsd} USD). Aguarda confirmação.`,
    relatedEntityType: 'AddonCobranca',
    relatedEntityId: cobranca.id,
  }).catch(() => {});

  return atualizada;
}

function novoValidoAte(validoAtual, meses, agora = new Date()) {
  const base = validoAtual && new Date(validoAtual) > agora ? new Date(validoAtual) : new Date(agora);
  const fim = new Date(base);
  fim.setMonth(fim.getMonth() + meses);
  return fim;
}

/**
 * O único sítio onde um add-on pago se torna ATIVO. Ativa CompanyAddon
 * (upsert — a primeira confirmação cria, as seguintes renovam) dentro da
 * mesma transação que confirma a cobrança.
 */
async function aplicarConfirmacao(cobranca, { dadosExtra = {}, actor, mensagemNotificacao }) {
  const def = definicao(cobranca.addonKey);
  const existente = await prisma.companyAddon.findUnique({
    where: { companyId_addonKey: { companyId: cobranca.companyId, addonKey: cobranca.addonKey } },
  });
  const validoAte = novoValidoAte(existente?.status === 'ATIVO' ? cobranca.validoAte : null, cobranca.meses);

  const atualizada = await prisma.$transaction(async (tx) => {
    const c = await tx.addonCobranca.update({
      where: { id: cobranca.id },
      data: { status: 'CONFIRMADA', confirmadaEm: new Date(), validoAte, ...dadosExtra },
    });

    await tx.companyAddon.upsert({
      where: { companyId_addonKey: { companyId: cobranca.companyId, addonKey: cobranca.addonKey } },
      create: { companyId: cobranca.companyId, addonKey: cobranca.addonKey, status: 'ATIVO', activatedAt: new Date() },
      update: { status: 'ATIVO', activatedAt: existente?.activatedAt || new Date() },
    });

    await auditService.record(tx, {
      actor,
      action: 'ADDON_CONFIRMADO',
      entityType: 'AddonCobranca',
      entityId: cobranca.id,
      entityRef: cobranca.referencia,
      detail: { addonKey: cobranca.addonKey, label: def.label, valorUsd: String(cobranca.valorUsd), validoAte: validoAte.toISOString() },
    });

    return c;
  });

  notificationService.notifyUsersByRole({
    companyId: cobranca.companyId,
    roles: ['COMPANY_ADMIN', 'FINANCEIRO'],
    type: 'SUBSCRICAO_CONFIRMADA',
    title: `Add-on "${def.label}" ativo`,
    message: mensagemNotificacao
      || `A cobrança ${cobranca.referencia} foi confirmada. O add-on "${def.label}" está ativo até `
      + `${validoAte.toISOString().slice(0, 10)}.`,
    relatedEntityType: 'AddonCobranca',
    relatedEntityId: cobranca.id,
  }).catch(() => {});

  return atualizada;
}

async function confirmar(cobrancaId, adminId, { notas } = {}, actor = null) {
  const cobranca = await prisma.addonCobranca.findUnique({ where: { id: cobrancaId } });
  if (!cobranca) throw new NotFoundError('Cobrança');
  if (cobranca.status === 'CONFIRMADA') {
    throw new ConflictError(`A cobrança ${cobranca.referencia} já foi confirmada.`);
  }
  if (cobranca.status === 'CANCELADA') {
    throw new ConflictError(`A cobrança ${cobranca.referencia} está cancelada.`);
  }
  if (!cobranca.comprovativoUrl) {
    throw new BusinessRuleError(
      `A cobrança ${cobranca.referencia} não tem comprovativo. `
      + 'Confirmar sem ele deixaria a plataforma a afirmar um pagamento que ninguém consegue mostrar.',
    );
  }

  return aplicarConfirmacao(cobranca, {
    dadosExtra: { confirmadaPor: adminId || null, ...(notas ? { notas } : {}) },
    actor: actor || { actorId: adminId },
  });
}

async function cancelar(cobrancaId, { motivo, companyId = null } = {}, actor = null) {
  if (!motivo || !String(motivo).trim()) {
    throw new ValidationError('Indique o motivo do cancelamento.');
  }
  const cobranca = await prisma.addonCobranca.findUnique({ where: { id: cobrancaId } });
  if (!cobranca) throw new NotFoundError('Cobrança');
  if (companyId && cobranca.companyId !== companyId) {
    throw new ForbiddenError('Só pode cancelar cobranças da sua própria empresa.');
  }
  if (!EM_ABERTO.includes(cobranca.status)) {
    throw new ConflictError(`A cobrança ${cobranca.referencia} está ${cobranca.status.toLowerCase()}.`);
  }

  const atualizada = await prisma.addonCobranca.update({
    where: { id: cobrancaId },
    data: { status: 'CANCELADA', notas: String(motivo).trim() },
  });

  await auditService.recordSafe({
    actor: actor || {},
    action: 'ADDON_CANCELADO',
    entityType: 'AddonCobranca',
    entityId: cobranca.id,
    entityRef: cobranca.referencia,
    detail: { motivo: String(motivo).trim(), addonKey: cobranca.addonKey, valorUsd: String(cobranca.valorUsd) },
  });

  return atualizada;
}

/** A fila de trabalho da KIXIMA: cobranças de add-on em aberto. */
async function fila() {
  const emAberto = await prisma.addonCobranca.findMany({
    where: { status: { in: EM_ABERTO } },
    include: { company: { select: { id: true, name: true, plan: true } } },
    orderBy: [{ status: 'desc' }, { createdAt: 'asc' }],
  });

  return {
    emAberto,
    porConfirmar: emAberto.filter((c) => c.status === 'COMPROVATIVO_ENVIADO').length,
    porPagar: emAberto.filter((c) => c.status === 'PENDENTE').length,
  };
}

module.exports = {
  ADDONS, catalogo, estado, assertAddon, pedir, submeterComprovativo, confirmar, cancelar, fila,
};
