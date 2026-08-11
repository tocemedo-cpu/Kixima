// src/services/authService.js

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const config = require('../config/env');
const { UnauthorizedError, ForbiddenError, ConflictError } = require('../utils/errors');

// Custo do bcrypt. 12 é o mínimo recomendado atualmente (mais lento = mais
// resistente a força bruta). Hashes antigos (custo 10) continuam válidos.
const SALT_ROUNDS = 12;

async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

function signToken(user) {
  // `tv` (tokenVersion) permite revogação server-side: o middleware compara-o
  // com o valor atual do utilizador em BD.
  return jwt.sign(
    { sub: user.id, role: user.role, companyId: user.companyId, tv: user.tokenVersion ?? 0 },
    config.auth.jwtSecret,
    { expiresIn: config.auth.jwtExpiresIn },
  );
}

// Revoga todas as sessões ativas de um utilizador (logout global): incrementa
// a tokenVersion, invalidando de imediato todos os JWT já emitidos.
async function revokeSessions(userId) {
  await prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
  return { ok: true };
}

// Convite de utilizador: token assinado (sem estado em BD) que o Company Admin
// partilha por link. Transporta a empresa e o perfil a atribuir; o convidado
// preenche o próprio cadastro e o admin aprova depois.
const INVITE_TTL = '7d';

function signInvite({ companyId, role, inviteId }) {
  const payload = { t: 'invite', companyId, role };
  if (inviteId) payload.iid = inviteId;
  return jwt.sign(payload, config.auth.jwtSecret, { expiresIn: INVITE_TTL });
}

function verifyInvite(token) {
  let payload;
  try {
    payload = jwt.verify(token, config.auth.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    throw new UnauthorizedError('Convite inválido ou expirado.');
  }
  if (payload.t !== 'invite' || !payload.companyId || !payload.role) {
    throw new UnauthorizedError('Convite inválido.');
  }
  return { companyId: payload.companyId, role: payload.role, inviteId: payload.iid || null };
}

async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email }, include: { company: true } });
  if (!user) {
    throw new UnauthorizedError('Credenciais inválidas.');
  }
  // Conta criada por convite fica inativa até o Company Admin aceitar o cadastro.
  if (!user.active) {
    throw new ForbiddenError('A sua conta ainda aguarda aprovação do administrador da empresa.');
  }

  // Empresas de Comprador/Company Admin/Fornecedor/Financeiro só podem entrar
  // se a empresa já foi aprovada na due diligence do Admin do Sistema.
  if (user.company && user.company.status !== 'APROVADA') {
    throw new ForbiddenError('A empresa ainda não foi aprovada no cadastro (due diligence).');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new UnauthorizedError('Credenciais inválidas.');
  }

  // 2FA ativo: a senha não basta. Devolve um desafio de curta duração; o token
  // de sessão só sai no /2fa/verify com um código TOTP válido.
  if (user.totpEnabledAt) {
    const challenge = jwt.sign(
      { t: '2fa', sub: user.id, tv: user.tokenVersion ?? 0 },
      config.auth.jwtSecret,
      { expiresIn: TWO_FA_CHALLENGE_TTL },
    );
    return { requires2fa: true, challenge };
  }

  return buildSession(user);
}

// Sessão completa (token + payload do utilizador) — partilhada por login e 2FA.
function buildSession(user) {
  return {
    token: signToken(user),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      companyName: user.company?.name ?? null,
      avatarUrl: user.avatarUrl ?? null,
    },
  };
}

// --- 2FA (TOTP) -------------------------------------------------------------
const totpUtil = require('../utils/totp');
const TWO_FA_CHALLENGE_TTL = '5m';

async function totpStatus(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { totpEnabledAt: true } });
  return { enabled: Boolean(user?.totpEnabledAt), enabledAt: user?.totpEnabledAt ?? null };
}

// Passo 1 da ativação: gera o segredo (fica pendente até confirmar um código).
async function setupTotp(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new UnauthorizedError('Sessão inválida.');
  if (user.totpEnabledAt) throw new ConflictError('A autenticação de dois fatores já está ativa.');

  const secret = totpUtil.generateSecret();
  await prisma.user.update({ where: { id: userId }, data: { totpSecret: secret, totpEnabledAt: null } });
  return { secret, otpauthUrl: totpUtil.otpauthUrl({ secret, label: user.email }) };
}

// Passo 2: o utilizador prova que a app está configurada — só então fica ativo.
async function enableTotp(userId, code) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.totpSecret) throw new ConflictError('Inicie primeiro a ativação (gerar o código QR).');
  if (user.totpEnabledAt) throw new ConflictError('A autenticação de dois fatores já está ativa.');
  if (!totpUtil.verify(code, user.totpSecret)) {
    throw new UnauthorizedError('Código incorreto. Confirme o código atual na app de autenticação.');
  }
  const updated = await prisma.user.update({ where: { id: userId }, data: { totpEnabledAt: new Date() } });
  return { enabled: true, enabledAt: updated.totpEnabledAt };
}

// Desativar exige um código válido (impede desativação por sessão roubada).
async function disableTotp(userId, code) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.totpEnabledAt) throw new ConflictError('A autenticação de dois fatores não está ativa.');
  if (!totpUtil.verify(code, user.totpSecret)) {
    throw new UnauthorizedError('Código incorreto. Confirme o código atual na app de autenticação.');
  }
  await prisma.user.update({ where: { id: userId }, data: { totpSecret: null, totpEnabledAt: null } });
  return { enabled: false };
}

// 2º passo do login: troca desafio + código TOTP pela sessão completa.
async function verify2fa(challenge, code) {
  let payload;
  try {
    payload = jwt.verify(challenge, config.auth.jwtSecret);
  } catch {
    throw new UnauthorizedError('Desafio expirado — volte a iniciar sessão.');
  }
  if (payload.t !== '2fa' || !payload.sub) {
    throw new UnauthorizedError('Desafio inválido — volte a iniciar sessão.');
  }
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, include: { company: true } });
  if (!user || !user.active || (user.tokenVersion ?? 0) !== payload.tv) {
    throw new UnauthorizedError('Sessão inválida — volte a iniciar sessão.');
  }
  if (!user.totpEnabledAt || !totpUtil.verify(code, user.totpSecret)) {
    throw new UnauthorizedError('Código incorreto. Confirme o código atual na app de autenticação.');
  }
  return buildSession(user);
}

async function createUser({ name, email, password, role, companyId, approvalCap }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ConflictError('Já existe um utilizador com este email.');
  }

  const passwordHash = await hashPassword(password);
  return prisma.user.create({
    data: { name, email, passwordHash, role, companyId, approvalCap },
  });
}

// Alteração de senha pelo próprio utilizador (módulo Segurança).
async function changePassword(userId, currentPassword, newPassword) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new UnauthorizedError('Sessão inválida.');
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw new UnauthorizedError('A senha atual está incorreta.');
  const passwordHash = await hashPassword(newPassword);
  // Ao trocar a senha, revoga as sessões antigas (todos os JWT anteriores).
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, tokenVersion: { increment: 1 } },
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Recuperação de senha ("Esqueci a senha")
// ---------------------------------------------------------------------------
// Token assinado de USO ÚNICO, sem estado extra em BD: transporta a tokenVersion
// atual do utilizador; ao redefinir a senha a tokenVersion incrementa, matando o
// próprio token de recuperação e todas as sessões antigas de uma só vez.
const RESET_TTL = '1h';

function signPasswordReset(user) {
  return jwt.sign(
    { t: 'pwreset', sub: user.id, tv: user.tokenVersion ?? 0 },
    config.auth.jwtSecret,
    { expiresIn: RESET_TTL },
  );
}

async function verifyPasswordReset(token) {
  let payload;
  try {
    payload = jwt.verify(token, config.auth.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    throw new UnauthorizedError('Link de recuperação inválido ou expirado. Peça um novo.');
  }
  if (payload.t !== 'pwreset' || !payload.sub) {
    throw new UnauthorizedError('Link de recuperação inválido.');
  }
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || (user.tokenVersion ?? 0) !== (payload.tv ?? 0)) {
    // tokenVersion mudou = o link já foi usado (ou a senha trocou entretanto).
    throw new UnauthorizedError('Este link de recuperação já foi utilizado ou expirou. Peça um novo.');
  }
  return user;
}

function buildResetEmail({ name, link }) {
  const subject = 'Recuperação de senha — KIXIMA';
  const text = [
    `Olá ${name},`, '',
    'Recebemos um pedido para redefinir a senha da sua conta KIXIMA.',
    'Clique no link abaixo para escolher uma nova senha (válido por 1 hora):', link, '',
    'Se não fez este pedido, ignore este email — a sua senha mantém-se.',
    '', 'Equipe Kixima.',
  ].join('\n');
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;line-height:1.5">
      <p>Olá <strong>${name}</strong>,</p>
      <p>Recebemos um pedido para redefinir a senha da sua conta KIXIMA.</p>
      <p style="margin:22px 0">
        <a href="${link}" style="background:#c1121f;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block">Redefinir senha</a>
      </p>
      <p style="font-size:13px;color:#666">O link é válido por 1 hora e só pode ser usado uma vez.</p>
      <p style="font-size:13px;color:#666">Se não fez este pedido, ignore este email — a sua senha mantém-se.</p>
      <p>Equipe Kixima.</p>
    </div>`;
  return { subject, text, html };
}

// Pedido de recuperação. NUNCA revela se o email existe (anti-enumeração): o
// controller devolve sempre a mesma resposta; aqui apenas não enviamos nada
// quando a conta não existe/está inativa.
async function requestPasswordReset(email, baseUrl = null) {
  const notificationService = require('./notificationService'); // require tardio (evita ciclos)
  const normEmail = String(email || '').trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normEmail } });
  if (!user || !user.active) return { sent: false };
  const token = signPasswordReset(user);
  const base = String(process.env.APP_URL || baseUrl || config.appUrl || '').replace(/\/$/, '');
  const link = `${base}/recuperar/${token}`;
  const { subject, text, html } = buildResetEmail({ name: user.name, link });
  await notificationService.sendEmail(user.email, subject, text, { html });
  return { sent: true };
}

// Redefinição efetiva: valida o token, grava a nova senha e revoga tudo o que
// estava emitido (sessões antigas + o próprio token de recuperação).
async function resetPassword(token, newPassword) {
  const user = await verifyPasswordReset(token);
  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, tokenVersion: { increment: 1 } },
  });
  return { ok: true };
}

module.exports = {
  login, createUser, hashPassword, signToken, signInvite, verifyInvite,
  changePassword, revokeSessions, requestPasswordReset, resetPassword,
  totpStatus, setupTotp, enableTotp, disableTotp, verify2fa,
};
