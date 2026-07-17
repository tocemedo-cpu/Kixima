// src/services/policyService.js
// Duas apólices distintas (secção 4 da especificação):
//  - Fornecedor→KIXIMA: submetida pelo próprio fornecedor no onboarding.
//  - KIXIMA→Cliente: emitida pelo Admin do Sistema após due diligence, por empresa.

const prisma = require('../config/database');
const { NotFoundError, ForbiddenError } = require('../utils/errors');
const notificationService = require('./notificationService');

// --- Fornecedor → KIXIMA ----------------------------------------------------

async function submitSupplierPolicy(companyId, { policyNumber, insurer, coverageAmount, currency, validFrom, validUntil }) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new NotFoundError('Empresa');
  if (company.type !== 'FORNECEDOR') {
    throw new ForbiddenError('Apenas empresas fornecedoras submetem a apólice Fornecedor→KIXIMA.');
  }

  const policy = await prisma.supplierToKiximaPolicy.create({
    data: { companyId, policyNumber, insurer, coverageAmount, currency, validFrom, validUntil, status: 'SUBMETIDA' },
  });

  await notificationService.events.apoliceSubmetidaOuAprovada(companyId, 'Fornecedor→KIXIMA');
  return policy;
}

async function decideSupplierPolicy(policyId, approve) {
  const policy = await prisma.supplierToKiximaPolicy.update({
    where: { id: policyId },
    data: { status: approve ? 'APROVADA' : 'REJEITADA' },
  });
  if (approve) {
    await notificationService.events.apoliceSubmetidaOuAprovada(policy.companyId, 'Fornecedor→KIXIMA');
  }
  return policy;
}

// --- KIXIMA → Cliente --------------------------------------------------------

async function issueClientPolicy(companyId, { policyNumber, insurer, coverageAmount, currency, validFrom, validUntil, issuedById }) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new NotFoundError('Empresa');

  const policy = await prisma.kiximaToClientPolicy.create({
    data: {
      companyId,
      policyNumber,
      insurer,
      coverageAmount,
      currency,
      validFrom,
      validUntil,
      issuedById,
      status: 'APROVADA',
    },
  });

  await notificationService.events.apoliceSubmetidaOuAprovada(companyId, 'KIXIMA→Cliente');
  return policy;
}

async function listPoliciesForCompany(companyId) {
  const [supplier, client] = await Promise.all([
    prisma.supplierToKiximaPolicy.findMany({ where: { companyId } }),
    prisma.kiximaToClientPolicy.findMany({ where: { companyId } }),
  ]);
  return { supplierToKixima: supplier, kiximaToClient: client };
}

/**
 * Job periódico (ver src/jobs/policyExpiryJob.js): avisa Company Admin e
 * Financeiro 30 dias antes da apólice KIXIMA→Cliente expirar. Evita reenvio
 * usando expiryAlertSentAt.
 */
async function sendExpiryAlerts() {
  const alertDays = require('../config/env').business.policyExpiryAlertDays;
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + alertDays);

  const expiring = await prisma.kiximaToClientPolicy.findMany({
    where: {
      status: 'APROVADA',
      validUntil: { lte: threshold, gte: new Date() },
      expiryAlertSentAt: null,
    },
  });

  for (const policy of expiring) {
    // eslint-disable-next-line no-await-in-loop
    await notificationService.events.apoliceAExpirar(policy.companyId, 'KIXIMA→Cliente', policy.validUntil);
    // eslint-disable-next-line no-await-in-loop
    await prisma.kiximaToClientPolicy.update({
      where: { id: policy.id },
      data: { expiryAlertSentAt: new Date() },
    });
  }

  return expiring.length;
}

module.exports = {
  submitSupplierPolicy,
  decideSupplierPolicy,
  issueClientPolicy,
  listPoliciesForCompany,
  sendExpiryAlerts,
};
