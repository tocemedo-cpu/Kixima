// src/services/companyService.js
// Cadastro/onboarding de empresas e due diligence (Admin do Sistema KIXIMA).

const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const { NotFoundError, BusinessRuleError, ConflictError } = require('../utils/errors');
const notificationService = require('./notificationService');
const storageService = require('./storageService');
const authService = require('./authService');

// Perfis que o Company Admin pode convidar, por tipo de empresa. Além do próprio
// Company Admin (criado no cadastro), a equipa é composta por Comprador,
// Vendedor (FORNECEDOR) e Financeiro — o Vendedor só existe em fornecedoras.
const INVITABLE_ROLES = {
  CLIENTE: ['COMPRADOR', 'FINANCEIRO'],
  FORNECEDOR: ['COMPRADOR', 'FORNECEDOR', 'FINANCEIRO'],
};
const USER_SELECT = { id: true, name: true, email: true, role: true, active: true, createdAt: true };

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
async function registerCompany(data, uploadedDocs = [], policyFile = null) {
  const {
    name, taxId, type, contactEmail, contactPhone, address,
    adminName, adminEmail, adminPassword,
    policyNumber, insurer, coverageAmount, policyCurrency, policyValidFrom, policyValidUntil,
  } = data;

  // 1. Documentos obrigatórios presentes?
  const required = REQUIRED_DOCS[type] || [];
  const providedTypes = new Set(uploadedDocs.map((d) => d.type));
  const missing = required.filter((t) => !providedTypes.has(t));
  if (missing.length) {
    throw new BusinessRuleError(`Documentos obrigatórios em falta: ${missing.map((t) => DOC_LABELS[t]).join(', ')}.`);
  }

  // 1b. Apólice de seguro Fornecedor→KIXIMA — obrigatória para fornecedoras.
  if (type === 'FORNECEDOR') {
    if (!policyNumber || !insurer || !coverageAmount || !policyValidFrom || !policyValidUntil) {
      throw new BusinessRuleError(
        'A apólice de seguro (Fornecedor→KIXIMA) é obrigatória no cadastro de empresas fornecedoras — indique seguradora, nº, cobertura e validade.'
      );
    }
    if (!policyFile) {
      throw new BusinessRuleError('Anexe o documento (PDF/imagem) da apólice de seguro.');
    }
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

  // 3b. Guardar o documento da apólice (se fornecedora e enviado).
  let policyDocumentUrl = null;
  if (type === 'FORNECEDOR' && policyFile) {
    policyDocumentUrl = await storageService.saveFile({
      buffer: policyFile.buffer,
      originalname: policyFile.originalname,
      mimetype: policyFile.mimetype,
      keyHint: `${taxId}-APOLICE`,
      folder: 'documents',
    });
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  // 4. Criar empresa + admin + documentos (+ apólice, se fornecedora) atómico.
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
    if (type === 'FORNECEDOR') {
      await tx.supplierToKiximaPolicy.create({
        data: {
          companyId: company.id,
          policyNumber,
          insurer,
          coverageAmount,
          currency: policyCurrency || 'AOA',
          validFrom: policyValidFrom,
          validUntil: policyValidUntil,
          documentUrl: policyDocumentUrl,
          status: 'SUBMETIDA',
        },
      });
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

// ---------------------------------------------------------------------------
// Convites de utilizadores (self-service com aprovação do Company Admin)
// ---------------------------------------------------------------------------

// Cria um convite (link assinado) para um perfil da própria empresa.
async function createInvite(companyId, role) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new NotFoundError('Empresa');
  const allowed = INVITABLE_ROLES[company.type] || [];
  if (!allowed.includes(role)) {
    throw new BusinessRuleError('Este perfil não pode ser convidado para este tipo de empresa.');
  }
  const token = authService.signInvite({ companyId, role });
  return { token, role, companyName: company.name };
}

// Resolve um convite (público) — mostra ao convidado a empresa e o perfil.
async function resolveInvite(token) {
  const { companyId, role } = authService.verifyInvite(token);
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new NotFoundError('Empresa');
  return { companyName: company.name, companyType: company.type, role };
}

// Aceitação de convite (público): o convidado preenche o próprio cadastro. A
// conta fica inativa até o Company Admin aceitar.
async function acceptInvite(token, { name, email, password }) {
  const { companyId, role } = authService.verifyInvite(token);
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new NotFoundError('Empresa');
  if (await prisma.user.findUnique({ where: { email } })) {
    throw new ConflictError('Já existe uma conta com este email.');
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, role, companyId, active: false },
    select: USER_SELECT,
  });
  return user;
}

async function listCompanyUsers(companyId) {
  return prisma.user.findMany({
    where: { companyId },
    orderBy: [{ active: 'asc' }, { createdAt: 'desc' }],
    select: USER_SELECT,
  });
}

// Company Admin aceita o cadastro de um utilizador convidado (ativa a conta).
async function activateCompanyUser(companyId, userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.companyId !== companyId) throw new NotFoundError('Utilizador');
  return prisma.user.update({ where: { id: userId }, data: { active: true }, select: USER_SELECT });
}

// Rejeita/remove um utilizador convidado (não permite remover o Company Admin).
async function removeCompanyUser(companyId, userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.companyId !== companyId) throw new NotFoundError('Utilizador');
  if (user.role === 'COMPANY_ADMIN') {
    throw new BusinessRuleError('Não é possível remover o administrador da empresa.');
  }
  await prisma.user.delete({ where: { id: userId } });
  return { id: userId };
}

// Bloquear/desbloquear um utilizador da própria empresa (Company Admin).
async function setCompanyUserStatus(companyId, userId, active, actingUserId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.companyId !== companyId) throw new NotFoundError('Utilizador');
  if (userId === actingUserId) throw new BusinessRuleError('Não pode bloquear a própria conta.');
  if (user.role === 'COMPANY_ADMIN') throw new BusinessRuleError('Não é possível bloquear o administrador da empresa.');
  return prisma.user.update({ where: { id: userId }, data: { active: Boolean(active) }, select: USER_SELECT });
}

module.exports = {
  registerCompany,
  listCompanies,
  getCompany,
  decideCompanyStatus,
  setBudgetLimit,
  createInvite,
  resolveInvite,
  acceptInvite,
  listCompanyUsers,
  activateCompanyUser,
  removeCompanyUser,
  setCompanyUserStatus,
};
