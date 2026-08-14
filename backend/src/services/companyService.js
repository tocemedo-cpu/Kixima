// src/services/companyService.js
// Cadastro/onboarding de empresas e due diligence (Admin do Sistema KIXIMA).

const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const { NotFoundError, BusinessRuleError, ConflictError, ValidationError } = require('../utils/errors');
const passwordPolicy = require('../utils/passwordPolicy');
const notificationService = require('./notificationService');
const planService = require('./planService');
const storageService = require('./storageService');
const authService = require('./authService');
const config = require('../config/env');

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
    employees, annualRevenueUsd, plan: chosenPlan,
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

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  // 4. Criar empresa + admin + documentos (+ apólice, se fornecedora) atómico.
  return prisma.$transaction(async (tx) => {
    // O aceite dos Termos/Privacidade já foi validado no schema (obrigatório);
    // aqui fica apenas o carimbo de QUANDO foi dado.
    const termsAcceptedAt = new Date();
    // Dimensão declarada → classificação automática (critério MPME angolano).
    // O plano segue a dimensão: GRANDE exige PRO; as restantes podem subir.
    const size = planService.classify({ employees, annualRevenueUsd });
    const minPlan = planService.requiredPlan(size);
    const plan = chosenPlan === 'PRO' || minPlan === 'PRO' ? 'PRO' : 'BASICO';
    const company = await tx.company.create({
      data: {
        name, taxId, type, contactEmail, contactPhone, address, status: 'PENDENTE', termsAcceptedAt,
        employees: employees ?? null,
        annualRevenueUsd: annualRevenueUsd ?? null,
        size,
        plan,
      },
    });
    await tx.user.create({
      data: { name: adminName, email: adminEmail, passwordHash, role: 'COMPANY_ADMIN', companyId: company.id, termsAcceptedAt },
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

// Dados bancários da empresa (o Fornecedor preenche/edita os seus). Alimentam a
// fatura/PO (secção "Dados para pagamento") em vez do "[a preencher]".
async function getBankDetails(companyId) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, bankName: true, iban: true, swift: true },
  });
  if (!company) throw new NotFoundError('Empresa');
  return company;
}

async function updateBankDetails(companyId, { bankName, iban, swift }) {
  await getBankDetails(companyId);
  return prisma.company.update({
    where: { id: companyId },
    data: {
      bankName: bankName?.trim() || null,
      iban: iban?.replace(/\s+/g, '').toUpperCase() || null,
      swift: swift?.replace(/\s+/g, '').toUpperCase() || null,
    },
    select: { id: true, name: true, bankName: true, iban: true, swift: true },
  });
}

// Dimensão e plano da empresa — o Admin do Sistema confirma/corrige o que foi
// declarado no cadastro. Rejeita descer o plano abaixo do exigido pela dimensão
// (uma GRANDE empresa não pode ficar no BASICO).
async function updatePlan(companyId, data) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new NotFoundError('Empresa');

  const employees = data.employees ?? company.employees;
  const annualRevenueUsd = data.annualRevenueUsd ?? (company.annualRevenueUsd != null ? Number(company.annualRevenueUsd) : undefined);
  const size = data.size || planService.classify({ employees, annualRevenueUsd });
  const plan = data.plan || company.plan;

  if (!planService.planAllowed(size, plan)) {
    throw new BusinessRuleError('Empresas de grande dimensão têm de subscrever o plano PRO.');
  }
  if (data.seatPriceUsd != null && data.seatPriceUsd > planService.SEAT_PRICE_CAP_USD) {
    throw new BusinessRuleError(`O preço por utilizador não pode exceder ${planService.SEAT_PRICE_CAP_USD} USD/mês.`);
  }

  return prisma.company.update({
    where: { id: companyId },
    data: {
      size, plan,
      employees: employees ?? null,
      annualRevenueUsd: annualRevenueUsd ?? null,
      ...(data.seatPriceUsd != null ? { seatPriceUsd: data.seatPriceUsd } : {}),
      ...(data.planNotes !== undefined ? { planNotes: data.planNotes } : {}),
    },
    select: { id: true, name: true, size: true, plan: true, seatPriceUsd: true, employees: true, annualRevenueUsd: true, planNotes: true },
  });
}

// Resumo de subscrição de uma empresa: plano, dimensão e custo mensal de acesso
// (nº de utilizadores ativos × preço por utilizador).
async function subscriptionFor(companyId) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, type: true, size: true, plan: true, seatPriceUsd: true, employees: true, annualRevenueUsd: true, planNotes: true },
  });
  if (!company) throw new NotFoundError('Empresa');
  const activeUsers = await prisma.user.count({ where: { companyId, active: true } });
  const cost = planService.monthlyAccessCost({ activeUsers, seatPriceUsd: Number(company.seatPriceUsd) });
  return {
    company,
    activeUsers,
    monthly: cost,
    requiredPlan: planService.requiredPlan(company.size),
    features: planService.features(company.plan),
    seatPriceCapUsd: planService.SEAT_PRICE_CAP_USD,
  };
}

// ---------------------------------------------------------------------------
// Convites de utilizadores (self-service com aprovação do Company Admin)
// ---------------------------------------------------------------------------

const INVITE_TTL_DAYS = 7;
const INVITE_SELECT = {
  id: true, name: true, email: true, role: true, status: true,
  expiresAt: true, acceptedAt: true, createdAt: true,
};

// Constrói o email de convite (assunto + corpo texto/HTML) para o funcionário.
function buildInviteEmail({ name, companyName, link }) {
  const subject = 'Convite para acessar a plataforma Kixima';
  const text = [
    `Olá ${name},`, '',
    `A empresa ${companyName} convidou você para acessar a plataforma Kixima.`, '',
    'Clique no link abaixo para completar o seu cadastro:', link, '',
    `Este link é válido por ${INVITE_TTL_DAYS} dias.`, '',
    'Equipe Kixima.',
  ].join('\n');
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;line-height:1.5">
      <p>Olá <strong>${name}</strong>,</p>
      <p>A empresa <strong>${companyName}</strong> convidou você para acessar a plataforma Kixima.</p>
      <p>Clique no botão abaixo para completar o seu cadastro:</p>
      <p style="margin:22px 0">
        <a href="${link}" style="background:#c1121f;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block">Completar Cadastro</a>
      </p>
      <p style="font-size:13px;color:#666">Este link é válido por ${INVITE_TTL_DAYS} dias.</p>
      <p>Equipe Kixima.</p>
    </div>`;
  return { subject, text, html };
}

// Envia (ou reenvia) o email de convite com o link único.
async function sendInviteEmail(invite, company, baseUrl = null) {
  // Prioridade: APP_URL explícito (config intencional, ex.: domínio próprio) >
  // endereço real do pedido (auto-deteção, resolve o caso em que APP_URL não
  // está definido) > fallback. Evita links para localhost em produção.
  const base = String(process.env.APP_URL || baseUrl || config.appUrl || '').replace(/\/$/, '');
  const link = `${base}/convite/${invite.token}`;
  const { subject, text, html } = buildInviteEmail({ name: invite.name, companyName: company.name, link });
  await notificationService.sendEmail(invite.email, subject, text, { html });
  return link;
}

// Cria um convite de funcionário: gera o link único, persiste o convite e
// envia automaticamente o email ao funcionário — sem o admin copiar nada.
/**
 * Há lugar livre no plano para mais uma pessoa?
 *
 * O limite é do PLANO, não da empresa: quem precisa de mais gente sobe de plano.
 * A conta inclui os convites por aceitar, senão bastava enviar todos os convites
 * de uma vez para o limite não valer nada.
 */
async function assertLugaresDisponiveis(company) {
  const [ativos, convitesAbertos] = await Promise.all([
    prisma.user.count({ where: { companyId: company.id, active: true } }),
    prisma.employeeInvite.count({
      where: { companyId: company.id, status: 'PENDENTE', expiresAt: { gt: new Date() } },
    }),
  ]);
  planService.assertLimite(company, 'lugaresIncluidos', ativos + convitesAbertos, 'lugares (utilizadores)');
}

async function createInvite(companyId, role, { name, email }, createdById = null, baseUrl = null) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new NotFoundError('Empresa');
  const allowed = INVITABLE_ROLES[company.type] || [];
  if (!allowed.includes(role)) {
    throw new BusinessRuleError('Este perfil não pode ser convidado para este tipo de empresa.');
  }
  // Lugares incluídos no plano. Contam-se os utilizadores ativos MAIS os
  // convites ainda por aceitar: sem isso, dez convites em fila passariam o
  // limite todos de uma vez, e a empresa só descobriria o excesso quando as
  // pessoas já tivessem criado conta.
  await assertLugaresDisponiveis(company);

  const normEmail = String(email).trim().toLowerCase();
  if (await prisma.user.findUnique({ where: { email: normEmail } })) {
    throw new ConflictError('Já existe uma conta com este email.');
  }
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  // Cria primeiro (obtém id), assina o token com o id e guarda-o.
  const created = await prisma.employeeInvite.create({
    data: { companyId, name: String(name).trim(), email: normEmail, role, token: 'pending', status: 'PENDENTE', expiresAt, createdById },
  });
  const token = authService.signInvite({ companyId, role, inviteId: created.id });
  const invite = await prisma.employeeInvite.update({ where: { id: created.id }, data: { token } });
  await sendInviteEmail(invite, company, baseUrl);
  return { ...pickInvite(invite), companyName: company.name };
}

// Lista os convites da empresa, marcando como EXPIRADO os pendentes vencidos.
async function listInvites(companyId) {
  const invites = await prisma.employeeInvite.findMany({
    where: { companyId }, orderBy: { createdAt: 'desc' },
  });
  return invites.map((i) => pickInvite(applyExpiry(i)));
}

// Reenvia o convite: renova token/validade (volta a PENDENTE) e reenvia o email.
async function resendInvite(companyId, inviteId, baseUrl = null) {
  const invite = await getOwnedInvite(companyId, inviteId);
  if (invite.status === 'ACEITO') throw new BusinessRuleError('Este convite já foi aceite.');
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  const token = authService.signInvite({ companyId, role: invite.role, inviteId });
  const updated = await prisma.employeeInvite.update({
    where: { id: inviteId }, data: { token, status: 'PENDENTE', expiresAt, acceptedAt: null },
  });
  await sendInviteEmail(updated, company, baseUrl);
  return pickInvite(updated);
}

// Cancela um convite pendente (impede a sua aceitação).
async function cancelInvite(companyId, inviteId) {
  const invite = await getOwnedInvite(companyId, inviteId);
  if (invite.status === 'ACEITO') throw new BusinessRuleError('Este convite já foi aceite.');
  const updated = await prisma.employeeInvite.update({ where: { id: inviteId }, data: { status: 'CANCELADO' } });
  return pickInvite(updated);
}

async function getOwnedInvite(companyId, inviteId) {
  const invite = await prisma.employeeInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.companyId !== companyId) throw new NotFoundError('Convite');
  return invite;
}

function applyExpiry(invite) {
  if (invite.status === 'PENDENTE' && invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
    return { ...invite, status: 'EXPIRADO' };
  }
  return invite;
}

function pickInvite(i) {
  return {
    id: i.id, name: i.name, email: i.email, role: i.role, status: i.status,
    expiresAt: i.expiresAt, acceptedAt: i.acceptedAt, createdAt: i.createdAt,
  };
}

// Resolve um convite (público) — mostra ao convidado a empresa, o perfil e os
// dados já preenchidos pelo administrador (nome/email).
async function resolveInvite(token) {
  const { companyId, role, inviteId } = authService.verifyInvite(token);
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new NotFoundError('Empresa');
  let name = null; let email = null;
  if (inviteId) {
    const invite = await getInviteForToken(inviteId, companyId);
    name = invite.name; email = invite.email;
  }
  return { companyName: company.name, companyType: company.type, role, name, email };
}

// Valida o convite persistido associado ao token (estado e validade).
async function getInviteForToken(inviteId, companyId) {
  const invite = await prisma.employeeInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.companyId !== companyId) throw new NotFoundError('Convite');
  if (invite.status === 'CANCELADO') throw new BusinessRuleError('Este convite foi cancelado.');
  if (invite.status === 'ACEITO') throw new BusinessRuleError('Este convite já foi aceite.');
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) throw new BusinessRuleError('Este convite expirou.');
  return invite;
}

// Aceitação de convite (público): o convidado define a senha. A conta fica
// inativa até o Company Admin aceitar. Compatível com convites antigos (sem
// registo persistido), em que o nome/email vêm do formulário.
async function acceptInvite(token, { name, email, password }) {
  const { companyId, role, inviteId } = authService.verifyInvite(token);
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new NotFoundError('Empresa');

  let finalName = name; let finalEmail = email; let invite = null;
  if (inviteId) {
    invite = await getInviteForToken(inviteId, companyId);
    finalName = invite.name;             // nome/email definidos pelo admin
    finalEmail = invite.email;
  }
  finalEmail = String(finalEmail || '').trim().toLowerCase();
  if (!finalName || !finalEmail) throw new BusinessRuleError('Dados do convite incompletos.');
  if (await prisma.user.findUnique({ where: { email: finalEmail } })) {
    throw new ConflictError('Já existe uma conta com este email.');
  }
  // O perfil do convidado vem do CONVITE, não do que ele envia — por isso a
  // política de senhas só pode ser aferida aqui. Um convite para Financeiro
  // exige o mesmo que qualquer outra conta que autoriza pagamentos.
  const erroSenha = passwordPolicy.validar(password, { role, email: finalEmail });
  if (erroSenha) throw new ValidationError(erroSenha);

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name: finalName, email: finalEmail, passwordHash, role, companyId, active: false, termsAcceptedAt: new Date() },
    select: USER_SELECT,
  });
  if (invite) {
    await prisma.employeeInvite.update({ where: { id: invite.id }, data: { status: 'ACEITO', acceptedAt: new Date() } });
  }
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
  getBankDetails,
  updateBankDetails,
  updatePlan,
  subscriptionFor,
  createInvite,
  listInvites,
  resendInvite,
  cancelInvite,
  resolveInvite,
  acceptInvite,
  listCompanyUsers,
  activateCompanyUser,
  removeCompanyUser,
  setCompanyUserStatus,
};
