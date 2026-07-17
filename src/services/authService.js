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

async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email }, include: { company: true } });
  if (!user || !user.active) {
    throw new UnauthorizedError('Credenciais inválidas.');
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

module.exports = { login, createUser, hashPassword, signToken };
