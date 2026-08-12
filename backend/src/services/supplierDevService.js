// src/services/supplierDevService.js
// Supplier Development — programa de apoio ao fornecedor nacional:
//   1) EMANCIPAÇÃO BUROCRÁTICA: acompanhamento no processo de registo,
//      licenciamento, certificações e conformidade exigidos pelo setor;
//   2) PARCERIAS INTERNACIONAIS: ligação de empresas locais a parceiros
//      estrangeiros, trazendo tecnologia e mais participação angolana ao setor.
//
// A candidatura é PÚBLICA (entra pela página de login e pela home) — pode vir de
// uma empresa que ainda nem está registada na plataforma. O Admin do Sistema
// trata e acompanha cada caso.
//
// COBRANÇA: a taxa de acesso ao programa é cobrada LOGO NA SUBMISSÃO DA
// INTENÇÃO — a candidatura nasce com a taxa emitida (PENDENTE) e o Admin do
// Sistema regista a receção. O restante do programa é orçamentado à parte.
const prisma = require('../config/database');
const { NotFoundError } = require('../utils/errors');
const { nextReference } = require('../utils/reference');
const notificationService = require('./notificationService');
const planService = require('./planService');
const logger = require('../config/logger');

const PUBLIC_SELECT = {
  id: true, reference: true, companyName: true, track: true, status: true, createdAt: true,
  accessFeeUsd: true, feeStatus: true, feePaidAt: true, programFeeUsd: true, customPricing: true,
};

// Cria uma candidatura. `companyId` só vem preenchido quando o pedido é feito
// por alguém já autenticado na plataforma.
async function create(data, companyId = null) {
  const reference = await nextReference('SD', 'supplierDevRequest');
  // A taxa de acesso ao programa é COBRADA LOGO NA SUBMISSÃO DA INTENÇÃO: a
  // candidatura nasce com a taxa emitida em estado PENDENTE. O restante do
  // programa é orçamentado depois da triagem (customPricing = true).
  const fee = planService.supplierDevAccessFee();
  const request = await prisma.supplierDevRequest.create({
    data: {
      reference,
      companyId,
      companyName: data.companyName,
      taxId: data.taxId || null,
      contactName: data.contactName,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone || null,
      province: data.province || null,
      sector: data.sector || null,
      employees: data.employees ?? null,
      track: data.track || 'AMBOS',
      needs: data.needs || null,
      accessFeeUsd: fee.amountUsd,
      feeStatus: 'PENDENTE',
      customPricing: true,
    },
  });

  // Avisa a equipa KIXIMA (não bloqueia a candidatura se o email falhar).
  try {
    await notificationService.events.supplierDevRecebida(request);
  } catch (err) {
    logger.error('Supplier Development: falha ao notificar a equipa', { reference, message: err.message });
  }

  return {
    reference: request.reference,
    status: request.status,
    accessFee: {
      amountUsd: fee.amountUsd,
      currency: fee.currency,
      // A taxa fica devida no acto: o candidato paga para o programa arrancar.
      dueOnSubmission: true,
      status: request.feeStatus,
      remainderCustom: true,
    },
  };
}

// Lista para o Admin do Sistema (paginada, filtrável por estado/percurso).
async function list({ page = 1, limit = 25, status, track, q } = {}) {
  const take = Math.min(Math.max(1, Number(limit) || 25), 100);
  const current = Math.max(1, Number(page) || 1);
  const where = {};
  if (status) where.status = status;
  if (track) where.track = track;
  if (q) {
    where.OR = [
      { companyName: { contains: q, mode: 'insensitive' } },
      { reference: { contains: q, mode: 'insensitive' } },
      { contactEmail: { contains: q, mode: 'insensitive' } },
    ];
  }
  const [total, items, byStatus, feePendentes] = await Promise.all([
    prisma.supplierDevRequest.count({ where }),
    prisma.supplierDevRequest.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (current - 1) * take, take }),
    prisma.supplierDevRequest.groupBy({ by: ['status'], _count: { _all: true } }),
    // Taxas de acesso emitidas na submissão e ainda por receber.
    prisma.supplierDevRequest.aggregate({
      where: { feeStatus: 'PENDENTE' },
      _count: { _all: true },
      _sum: { accessFeeUsd: true },
    }),
  ]);
  const counts = Object.fromEntries(byStatus.map((s) => [s.status, s._count._all]));
  return {
    items,
    total,
    page: current,
    pages: Math.max(1, Math.ceil(total / take)),
    kpis: {
      total: await prisma.supplierDevRequest.count(),
      recebidas: counts.RECEBIDA || 0,
      emAnalise: counts.EM_ANALISE || 0,
      acompanhamento: counts.EM_ACOMPANHAMENTO || 0,
      concluidas: counts.CONCLUIDA || 0,
      taxasPendentes: feePendentes._count._all || 0,
      taxasPendentesUsd: Number(feePendentes._sum.accessFeeUsd || 0),
    },
  };
}

// Admin atualiza o estado, as notas, a receção da taxa de acesso e o orçamento
// do restante do programa.
async function update(id, { status, adminNotes, feeStatus, programFeeUsd }, user) {
  const request = await prisma.supplierDevRequest.findUnique({ where: { id } });
  if (!request) throw new NotFoundError('Candidatura');
  return prisma.supplierDevRequest.update({
    where: { id },
    data: {
      ...(status ? { status } : {}),
      ...(adminNotes !== undefined ? { adminNotes } : {}),
      // Receção da taxa de acesso cobrada na submissão.
      ...(feeStatus
        ? { feeStatus, feePaidAt: feeStatus === 'COBRADO' ? request.feePaidAt || new Date() : null }
        : {}),
      // Orçamento do restante do programa: deixa de estar por definir.
      ...(programFeeUsd !== undefined ? { programFeeUsd, customPricing: false } : {}),
      handledById: user?.id ?? request.handledById,
      handledAt: new Date(),
    },
  });
}

// Consulta pública do estado por referência (a empresa acompanha sem conta).
async function trackByReference(reference) {
  const request = await prisma.supplierDevRequest.findUnique({
    where: { reference },
    select: PUBLIC_SELECT,
  });
  if (!request) throw new NotFoundError('Candidatura');
  return request;
}

module.exports = { create, list, update, trackByReference };
