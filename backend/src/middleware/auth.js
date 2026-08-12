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

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { company: { select: { type: true } } },
  });
  if (!user || !user.active) {
    throw new UnauthorizedError('Utilizador inválido ou inativo.');
  }
  // Revogação server-side: se a tokenVersion do token não corresponder à atual
  // (logout global, troca de senha, bloqueio), o token deixou de ser válido.
  if ((payload.tv ?? 0) !== (user.tokenVersion ?? 0)) {
    throw new UnauthorizedError('Sessão terminada. Inicie sessão novamente.');
  }

  req.user = {
    id: user.id,
    role: user.role,
    companyId: user.companyId,
    // Tipo da empresa (CLIENTE/FORNECEDOR) — permite adaptar telas ao lado do
    // negócio (ex.: Financeiro numa fornecedora vê "recebimentos", não "faturas
    // a pagar").
    companyType: user.company?.type ?? null,
    approvalCap: user.approvalCap,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
  };

  next();
}

// Autenticação OPCIONAL: usada em endpoints públicos que ganham contexto se
// houver sessão (ex.: candidatura ao Supplier Development feita por alguém já
// dentro da plataforma). Nunca bloqueia — sem token válido, segue sem req.user.
async function optionalAuthenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return next();
  try {
    await authenticate(req, res, () => {});
  } catch {
    // Token inválido/expirado num endpoint público: ignora-se.
  }
  next();
}

module.exports = { authenticate, optionalAuthenticate };
