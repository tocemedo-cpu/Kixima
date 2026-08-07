// src/middleware/auth.js
// Autenticação por JWT. Popula req.user com { id, role, companyId }.

const jwt = require('jsonwebtoken');
const config = require('../config/env');
const prisma = require('../config/database');
const { UnauthorizedError } = require('../utils/errors');

async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new UnauthorizedError('Token em falta. Envie "Authorization: Bearer <token>".');
  }

  let payload;
  try {
    payload = jwt.verify(token, config.auth.jwtSecret, { algorithms: ['HS256'] });
  } catch (err) {
    throw new UnauthorizedError('Token inválido ou expirado.');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.active) {
    throw new UnauthorizedError('Utilizador inválido ou inativo.');
  }

  req.user = {
    id: user.id,
    role: user.role,
    companyId: user.companyId,
    approvalCap: user.approvalCap,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
  };

  next();
}

module.exports = { authenticate };
