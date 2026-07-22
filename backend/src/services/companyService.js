// src/services/companyService.js
// Cadastro/onboarding de empresas e due diligence (Admin do Sistema KIXIMA).

const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const { NotFoundError, BusinessRuleError, ConflictError } = require('../utils/errors');
const notificationService = require('./notificationService');
const storageService = require('./storageService');

// Documentos obrigatórios por tipo de empresa (secção 4.1).
const REQUIRED_DOCS = {
  CLIENTE: ['CERTIDAO_COMERCIAL', 'ALVARA_COMERCIAL'],
  FORNECEDOR: ['ALVARA_COMERCIAL', 'LICENCA_ANPG', 'CERTIDAO_COMERCIAL'],
};
const DOC_LABELS = {
  CERTIDAO_COMERCIAL: 'Certidão Comercial',
  ALVARA_COMERCIAL: 'Alvará Comercial',
  LICENCA_ANPG: 'Licença da ANPG',
};

/**
 * Cadastro público de empresa: cria a empresa (PENDENTE), o primeiro
 * utilizador (Company Admin, com senha — para poder entrar após a aprovação) e
 * guarda os documentos de credenciamento exigidos para o tipo de empresa.
 * @param uploadedDocs [{ type, file }]
 */
async function registerCompany(data, uploadedDocs = []) {
  const { name, taxId, type, contactEmail, contactPhone, address, adminName, adminEmail, adminPassword } = data;

  // 1. Documentos obrigatórios presentes?
  const required = REQUIRED_DOCS[type] || [];
  const providedTypes = new Set(uploadedDocs.map((d) => d.type));
  const missing = required.filter((t) => !providedTypes.has(t));
  if (missing.length) {
    throw new BusinessRuleError(`Documentos obrigatórios em falta: ${missing.map((t) => DOC_LABELS[t]).join(', ')}.`);
  }

  // 2. Unicidade (falhar cedo, antes de guardar ficheiros).
  if (await prisma.company.findUnique({ where: { taxId } })) {
    throw new ConflictError('Já existe uma empresa registada com este NIF.');
  }
  if (await prisma.user.findUnique({ where: { email: adminEmail } })) {
    throw new ConflictError('Já existe uma conta com este email.');
  }

  // 3. Guardar os ficheiros dos documentos exigidos.
  const docRecords = [];
  for (const d of uploadedDocs) {
    if (!required.includes(d.type)) continue;
    const fileUrl = await storageService.saveFile({
      buffer: d.file.buffer,
      originalname: d.file.originalname,
      mimetype: d.file.mimetype,
      keyHint: `${taxId}-${d.type}`,
      folder: 'documents',
    });
    docRecords.push({ type: d.type, fileUrl, originalName: d.file.originalname });
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  // 4. Criar empresa + admin + documentos de forma atómica.
  return prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: { name, taxId, type, contactEmail, contactPhone, address, status: 'PENDENTE' },
    });
    await tx.user.create({
      data: { name: adminName, email: adminEmail, passwordHash, role: 'COMPANY_ADMIN', companyId: company.id },
    });
    for (const dr of docRecords) {
      await tx.companyDocument.create({ data: { ...dr, companyId: company.id } });
    }
    return company;
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
      documents: { orderBy: { type: 'asc' } },
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
