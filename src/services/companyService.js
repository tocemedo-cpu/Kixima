// src/services/companyService.js
// Cadastro/onboarding de empresas e due diligence (Admin do Sistema KIXIMA).

const prisma = require('../config/database');
const { NotFoundError, BusinessRuleError } = require('../utils/errors');
const notificationService = require('./notificationService');

async function registerCompany({ name, taxId, type, contactEmail, contactPhone, address }) {
  return prisma.company.create({
    data: { name, taxId, type, contactEmail, contactPhone, address, status: 'PENDENTE' },
  });
}

async function listCompanies({ status, type } = {}) {
  return prisma.company.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function getCompany(id) {
  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      supplierPolicies: true,
      clientPolicies: true,
      budgetLimit: true,
    },
  });
  if (!company) throw new NotFoundError('Empresa');
  return company;
}

/**
 * Aprovação de cadastro pelo Admin do Sistema KIXIMA.
 * Fornecedores só podem ser aprovados se já tiverem submetido a apólice
 * Fornecedor→KIXIMA (condição de credenciamento, secção 4.1 da especificação).
 */
async function decideCompanyStatus(companyId, { approve, rejectionReason }) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { supplierPolicies: true },
  });
  if (!company) throw new NotFoundError('Empresa');

  if (approve && company.type === 'FORNECEDOR') {
    const hasSubmittedPolicy = company.supplierPolicies.some((p) => p.status !== 'REJEITADA');
    if (!hasSubmittedPolicy) {
      throw new BusinessRuleError(
        'Fornecedor não pode ser aprovado sem apólice Fornecedor→KIXIMA submetida.'
      );
    }
  }

  const updated = await prisma.company.update({
    where: { id: companyId },
    data: approve
      ? { status: 'APROVADA', approvedAt: new Date() }
      : { status: 'REJEITADA', rejectedAt: new Date() },
  });

  await notificationService.events.cadastroEmpresaDecidido(updated);
  return updated;
}

async function setBudgetLimit(companyId, { periodMonthly, currency }) {
  await getCompany(companyId);
  return prisma.budgetLimit.upsert({
    where: { companyId },
    update: { periodMonthly, currency },
    create: { companyId, periodMonthly, currency },
  });
}

module.exports = { registerCompany, listCompanies, getCompany, decideCompanyStatus, setBudgetLimit };
