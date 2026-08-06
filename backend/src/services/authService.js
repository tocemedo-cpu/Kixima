// src/services/authService.js

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const config = require('../config/env');
const { UnauthorizedError, ForbiddenError, ConflictError } = require('../utils/errors');

const SALT_ROUNDS = 10;

async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, companyId: user.companyId }, config.auth.jwtSecret, {
    expiresIn: config.auth.jwtExpiresIn,
  });
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
    payload = jwt.verify(token, config.auth.jwtSecret);
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

  const token = signToken(user);
  return {
    token,
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
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  return { ok: true };
}

module.exports = { login, createUser, hashPassword, signToken, signInvite, verifyInvite, changePassword };
