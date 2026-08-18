// src/services/adminService.js
// Administração global (Admin do Sistema): permissões (bloquear/desbloquear
// qualquer utilizador), convite de assessores e gestão de atividades de tudo
// o que acontece no sistema.
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../config/database');
const {
  BusinessRuleError, NotFoundError, ConflictError, ValidationError,
} = require('../utils/errors');
const passwordPolicy = require('../utils/passwordPolicy');
const notificationService = require('./notificationService');
const config = require('../config/env');
const { AREAS_ADMIN, AREAS_ADMIN_LABEL } = require('../utils/adminAreas');

const pretty = (s) => String(s || '').replaceAll('_', ' ').toLowerCase();

async function listUsers() {
  const users = await prisma.user.findMany({
    select: {
      id: true, name: true, email: true, role: true, active: true, companyId: true, createdAt: true, adminAreas: true, company: { select: { name: true } },
    },
    orderBy: [{ active: 'asc' }, { createdAt: 'desc' }],
  });
  return users.map((u) => ({
    id: u.id, name: u.name, email: u.email, role: u.role, active: u.active, companyName: u.company?.name || null, createdAt: u.createdAt, adminAreas: u.adminAreas,
  }));
}

// Bloquear/desbloquear qualquer utilizador do sistema.
async function setUserStatus({ id, active, actingUserId }) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundError('Utilizador');
  if (id === actingUserId) throw new BusinessRuleError('Não pode bloquear a própria conta.');
  return prisma.user.update({ where: { id }, data: { active: Boolean(active) }, select: { id: true, name: true, active: true, role: true } });
}

// Atribuir áreas a um Admin do Sistema (vazio = Super Admin).
//
// Não pode alterar a PRÓPRIA conta: um Super Admin que restringisse as suas
// próprias áreas por engano ficava de fora das rotas que só o Super Admin
// gere — incluindo esta, que devolveria o próprio acesso. Sem outro Super
// Admin para o desfazer, é um bloqueio sem saída.
async function setUserAreas({ id, areas, actingUserId }) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundError('Utilizador');
  if (user.role !== 'ADMIN_SISTEMA') throw new BusinessRuleError('Áreas só se aplicam a Admin do Sistema.');
  if (id === actingUserId) throw new BusinessRuleError('Não pode alterar as próprias áreas.');
  return prisma.user.update({
    where: { id }, data: { adminAreas: areas }, select: { id: true, name: true, role: true, adminAreas: true },
  });
}

// ---------------------------------------------------------------------------
// Convite de Assessor (ADMIN_SISTEMA por área)
//
// Reutiliza a MESMA tabela e o MESMO ciclo de vida do convite de funcionário
// (EmployeeInvite: Pendente/Aceite/Expirado/Cancelado, reenvio, cancelamento)
// — não há uma segunda tabela nem um segundo sistema de convites.
//
// O TOKEN é diferente de propósito. O convite de funcionário assina um JWT
// com o papel embutido (authService.signInvite) — funciona porque a única
// coisa em jogo é uma conta de empresa. Aqui a aposta é maior: aceitar este
// convite cria um utilizador com poder sobre a PLATAFORMA INTEIRA. Por isso o
// token é um valor aleatório opaco (32 bytes, crypto.randomBytes) que não
// guarda NADA lá dentro — é só a chave de consulta. As áreas, o nome e o
// email vêm sempre da linha na base de dados, nunca do token, e nunca do que
// o assessor envia no pedido de aceitação.
// ---------------------------------------------------------------------------

const ADMIN_INVITE_TTL_DIAS = 7;

function gerarTokenDeConvite() {
  return crypto.randomBytes(32).toString('hex');
}

function buildAdminInviteEmail({ name, link, areaLabels }) {
  const subject = 'Convite para acesso administrativo ao Kixima';
  const listaAreas = areaLabels.join(', ');
  const text = [
    `Olá ${name},`, '',
    'Foi convidado a ser Admin do Sistema KIXIMA, com acesso às seguintes áreas:',
    listaAreas, '',
    'Clique no link abaixo para completar o seu cadastro e definir a sua senha:', link, '',
    `Este link é válido por ${ADMIN_INVITE_TTL_DIAS} dias e só pode ser usado uma vez.`, '',
    'Se não esperava este convite, ignore este email — ninguém consegue aceder com ele sem o clicar.', '',
    'Equipa Kixima.',
  ].join('\n');
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;line-height:1.5">
      <p>Olá <strong>${name}</strong>,</p>
      <p>Foi convidado a ser <strong>Admin do Sistema KIXIMA</strong>, com acesso às seguintes áreas:</p>
      <p><strong>${listaAreas}</strong></p>
      <p>Clique no botão abaixo para completar o seu cadastro e definir a sua senha:</p>
      <p style="margin:22px 0">
        <a href="${link}" style="background:#c1121f;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block">Completar Cadastro</a>
      </p>
      <p style="font-size:13px;color:#666">Este link é válido por ${ADMIN_INVITE_TTL_DIAS} dias e só pode ser usado uma vez.</p>
      <p style="font-size:13px;color:#666">Se não esperava este convite, ignore este email.</p>
      <p>Equipa Kixima.</p>
    </div>`;
  return { subject, text, html };
}

async function sendAdminInviteEmail(invite, baseUrl = null) {
  const base = String(process.env.APP_URL || baseUrl || config.appUrl || '').replace(/\/$/, '');
  const link = `${base}/convite-admin/${invite.token}`;
  const areaLabels = (invite.adminAreas || []).map((a) => AREAS_ADMIN_LABEL[a] || a);
  const { subject, text, html } = buildAdminInviteEmail({ name: invite.name, link, areaLabels });
  await notificationService.sendEmail(invite.email, subject, text, { html });
  return link;
}

function applyExpiry(invite) {
  if (invite.status === 'PENDENTE' && invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
    return { ...invite, status: 'EXPIRADO' };
  }
  return invite;
}

function pickAdminInvite(i) {
  return {
    id: i.id, name: i.name, email: i.email, adminAreas: i.adminAreas, status: i.status,
    expiresAt: i.expiresAt, acceptedAt: i.acceptedAt, createdAt: i.createdAt,
  };
}

// Convidar um novo assessor. Só chega aqui quem já passou por
// requireSuperAdmin() na rota — mas a validação das áreas fica aqui também,
// porque um serviço não deve confiar em quem o chama para lhe poupar o
// trabalho de se defender sozinho.
async function createAdminInvite({ name, email, adminAreas }, createdById = null, baseUrl = null) {
  const areas = [...new Set(Array.isArray(adminAreas) ? adminAreas : [])];
  const invalidas = areas.filter((a) => !AREAS_ADMIN.includes(a));
  if (invalidas.length) throw new BusinessRuleError(`Área desconhecida: ${invalidas.join(', ')}.`);
  // VAZIO nunca se grava num convite: promoveria a Super Admin sem ninguém
  // ter decidido isso explicitamente através do ecrã de áreas.
  if (!areas.length) throw new BusinessRuleError('Selecione pelo menos uma área administrativa.');

  const normEmail = String(email).trim().toLowerCase();
  if (await prisma.user.findUnique({ where: { email: normEmail } })) {
    throw new ConflictError('Já existe uma conta com este email.');
  }

  const token = gerarTokenDeConvite();
  const expiresAt = new Date(Date.now() + ADMIN_INVITE_TTL_DIAS * 24 * 60 * 60 * 1000);
  const invite = await prisma.employeeInvite.create({
    data: {
      companyId: null, name: String(name).trim(), email: normEmail, role: 'ADMIN_SISTEMA',
      adminAreas: areas, token, status: 'PENDENTE', expiresAt, createdById,
    },
  });
  await sendAdminInviteEmail(invite, baseUrl);
  return pickAdminInvite(invite);
}

async function listAdminInvites() {
  const invites = await prisma.employeeInvite.findMany({
    where: { role: 'ADMIN_SISTEMA' }, orderBy: { createdAt: 'desc' },
  });
  return invites.map((i) => pickAdminInvite(applyExpiry(i)));
}

async function getAdminInvite(inviteId) {
  const invite = await prisma.employeeInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.role !== 'ADMIN_SISTEMA') throw new NotFoundError('Convite');
  return invite;
}

// Reenvia: gera um token NOVO (o anterior fica órfão — já não corresponde a
// nada, mesmo que alguém ainda o tivesse guardado) e reabre o prazo.
async function resendAdminInvite(inviteId, baseUrl = null) {
  const invite = await getAdminInvite(inviteId);
  if (invite.status === 'ACEITO') throw new BusinessRuleError('Este convite já foi aceite.');
  const token = gerarTokenDeConvite();
  const expiresAt = new Date(Date.now() + ADMIN_INVITE_TTL_DIAS * 24 * 60 * 60 * 1000);
  const updated = await prisma.employeeInvite.update({
    where: { id: inviteId }, data: { token, status: 'PENDENTE', expiresAt, acceptedAt: null },
  });
  await sendAdminInviteEmail(updated, baseUrl);
  return pickAdminInvite(updated);
}

async function cancelAdminInvite(inviteId) {
  const invite = await getAdminInvite(inviteId);
  if (invite.status === 'ACEITO') throw new BusinessRuleError('Este convite já foi aceite.');
  const updated = await prisma.employeeInvite.update({ where: { id: inviteId }, data: { status: 'CANCELADO' } });
  return pickAdminInvite(updated);
}

/**
 * Valida o token de um convite de assessor — por CONSULTA à base, não por
 * verificação de assinatura: o próprio token não guarda nada, é só a chave.
 * Só uma linha PENDENTE e dentro do prazo é válida; qualquer outro estado
 * (cancelado, já aceite, expirado) é o mesmo "não" com uma explicação
 * diferente, para quem vê o ecrã perceber porquê.
 */
async function getInviteForAdminToken(token) {
  const invite = await prisma.employeeInvite.findUnique({ where: { token: String(token || '') } });
  if (!invite || invite.role !== 'ADMIN_SISTEMA') throw new BusinessRuleError('Convite inválido.');
  if (invite.status === 'CANCELADO') throw new BusinessRuleError('Este convite foi cancelado.');
  if (invite.status === 'ACEITO') throw new BusinessRuleError('Este convite já foi utilizado.');
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) throw new BusinessRuleError('Este convite expirou.');
  return invite;
}

// Resolve um convite (público) — o que o ecrã de aceitação mostra antes do
// assessor definir a senha. As áreas vêm só para MOSTRAR; nunca são lidas de
// volta a partir do que o assessor submeter a seguir.
async function resolveAdminInvite(token) {
  const invite = await getInviteForAdminToken(token);
  return {
    name: invite.name, email: invite.email, adminAreas: invite.adminAreas,
  };
}

// Aceitação (pública): o assessor define a senha e a conta é criada já ATIVA
// — ao contrário do convite de funcionário, não há um segundo aprovador
// depois disto; o Super Admin já decidiu ao enviar o convite.
//
// Note-se a assinatura: só recebe `password`. Não há parâmetro `adminAreas`
// nem `name`/`email` vindos do pedido — mesmo que o corpo do pedido HTTP
// trouxesse esses campos, esta função nunca os lê. As áreas, o nome e o email
// são sempre os da linha do convite.
async function acceptAdminInvite(token, { password }) {
  const invite = await getInviteForAdminToken(token);
  if (await prisma.user.findUnique({ where: { email: invite.email } })) {
    throw new ConflictError('Já existe uma conta com este email.');
  }
  const erroSenha = passwordPolicy.validar(password, { role: 'ADMIN_SISTEMA', email: invite.email });
  if (erroSenha) throw new ValidationError(erroSenha);

  const passwordHash = await bcrypt.hash(password, 12);
  // Transação: criar a conta e invalidar o convite têm de acontecer as duas
  // ou nenhuma. Sem isto, uma falha a meio deixava um convite "PENDENTE" que
  // na prática já tinha sido usado — reabrindo a porta para o token ser
  // reutilizado, exatamente o que "utilização única" promete impedir.
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: invite.name, email: invite.email, passwordHash, role: 'ADMIN_SISTEMA',
        companyId: null, adminAreas: invite.adminAreas, active: true, termsAcceptedAt: new Date(),
      },
      select: {
        id: true, name: true, email: true, role: true, adminAreas: true, active: true, createdAt: true,
      },
    });
    await tx.employeeInvite.update({ where: { id: invite.id }, data: { status: 'ACEITO', acceptedAt: new Date() } });
    return user;
  });
}

// Feed de atividades de todo o sistema.
async function systemActivities() {
  const [orders, companies, users, payments, tickets, policies, kpis] = await Promise.all([
    prisma.purchaseOrder.findMany({ include: { buyerCompany: { select: { name: true } }, supplierCompany: { select: { name: true } } }, orderBy: { updatedAt: 'desc' }, take: 25 }),
    prisma.company.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
    prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 10, include: { company: { select: { name: true } } } }),
    prisma.payment.findMany({ orderBy: { processedAt: 'desc' }, take: 10 }),
    prisma.supportTicket.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
    prisma.supplierToKiximaPolicy.findMany({ orderBy: { createdAt: 'desc' }, take: 10, include: { company: { select: { name: true } } } }),
    (async () => ({
      empresas: await prisma.company.count(),
      utilizadores: await prisma.user.count(),
      ordens: await prisma.purchaseOrder.count(),
      pagamentos: await prisma.payment.count(),
      tickets: await prisma.supportTicket.count(),
    }))(),
  ]);

  const ev = [];
  for (const o of orders) ev.push({ type: 'Ordem de Compra', module: 'Compras', title: `PO ${o.reference}`, detail: `${pretty(o.status)} — ${o.buyerCompany?.name} → ${o.supplierCompany?.name}`, at: o.updatedAt });
  for (const c of companies) ev.push({ type: 'Empresa', module: 'Credenciamento', title: c.name, detail: `Empresa ${pretty(c.type)} — estado ${pretty(c.status)}`, at: c.createdAt });
  for (const u of users) ev.push({ type: 'Utilizador', module: 'Contas', title: u.name, detail: `Novo ${pretty(u.role)} — ${u.company?.name || '—'}`, at: u.createdAt });
  for (const p of payments) ev.push({ type: 'Pagamento', module: 'Financeiro', title: p.reference, detail: 'Pagamento processado', at: p.processedAt });
  for (const t of tickets) ev.push({ type: 'Suporte', module: 'Ajuda', title: `#${t.reference}`, detail: t.subject, at: t.createdAt });
  for (const pl of policies) ev.push({ type: 'Apólice', module: 'Seguros', title: pl.policyNumber, detail: `${pl.insurer} — ${pl.company?.name || ''}`, at: pl.createdAt });
  ev.sort((a, b) => new Date(b.at) - new Date(a.at));

  return { kpis, items: ev.slice(0, 60) };
}

// Livro de taxas da plataforma (KIXIMA) — todas as taxas geradas nos pagamentos.
async function listPlatformFees() {
  const fees = await prisma.platformFee.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      company: { select: { name: true, type: true } },
      invoice: { select: { reference: true, amount: true, currency: true } },
    },
  });
  const totalAOA = fees.reduce((s, f) => s + Number(f.amount), 0);
  const pendingAOA = fees.filter((f) => f.status === 'PENDENTE').reduce((s, f) => s + Number(f.amount), 0);
  return {
    fees,
    kpis: { total: fees.length, totalAOA, pendingAOA, cobradas: fees.filter((f) => f.status === 'COBRADO').length },
  };
}

// Marcar uma taxa como cobrada (enquanto não há débito automático).
async function chargePlatformFee(id) {
  const fee = await prisma.platformFee.findUnique({ where: { id } });
  if (!fee) throw new NotFoundError('Taxa');
  return prisma.platformFee.update({ where: { id }, data: { status: 'COBRADO', chargedAt: new Date() } });
}

module.exports = {
  listUsers,
  setUserStatus,
  setUserAreas,
  createAdminInvite,
  listAdminInvites,
  resendAdminInvite,
  cancelAdminInvite,
  resolveAdminInvite,
  acceptAdminInvite,
  systemActivities,
  listPlatformFees,
  chargePlatformFee,
};
