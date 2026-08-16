// src/middleware/auth.js
// Autenticação por JWT. Popula req.user com { id, role, companyId }.

const jwt = require('jsonwebtoken');
const config = require('../config/env');
const prisma = require('../config/database');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');
const mfaPolicy = require('../services/mfaPolicy');
const sessionCookie = require('../utils/sessionCookie');

/**
 * O token desta sessão: primeiro o cookie httpOnly (é assim que a interface
 * autentica), depois o cabeçalho Bearer (clientes programáticos e testes).
 *
 * O cookie tem prioridade de propósito: se alguém enviasse os dois, o que vale
 * é o que o browser gere — não um cabeçalho que o JavaScript da página possa
 * ter posto lá.
 */
function tokenDoPedido(req) {
  const doCookie = sessionCookie.ler(req);
  if (doCookie) return doCookie;
  const [scheme, token] = String(req.headers.authorization || '').split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

async function authenticate(req, res, next) {
  const token = tokenDoPedido(req);

  if (!token) {
    throw new UnauthorizedError('Sessão em falta. Inicie sessão para continuar.');
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
    // Só tem efeito para ADMIN_SISTEMA (ver requirePermission em rbac.js);
    // vazio para os outros papéis, sem significado nenhum para eles.
    adminAreas: user.adminAreas || [],
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

  // 2FA obrigatória para os perfis que aprovam dinheiro ou credenciam empresas.
  // Passado o prazo, a sessão fica RESTRITA em vez de ser recusada: barrar o
  // login trancaria o administrador fora da própria conta, já que ativar a 2FA
  // exige estar dentro. Assim entra, mas só chega ao que precisa para a ativar.
  const mfa = mfaPolicy.estadoPara(user);
  req.user.mfaPendente = mfa.pendente;
  req.user.mfaRestrita = mfa.restrita;
  // O prazo vai junto: sem ele, o aviso na interface diz "ative" sem dizer até
  // quando — e um pedido sem data é um pedido que se adia.
  req.user.mfaPrazo = mfa.prazo;
  // req.path é relativo ao router onde o middleware corre (/me e não
  // /api/auth/me) — a lista de permitidos é sobre o caminho completo.
  const caminho = String(req.originalUrl || req.path).split('?')[0];
  if (mfa.restrita && !mfaPolicy.caminhoPermitido(caminho)) {
    throw new ForbiddenError(
      'A verificação em dois passos passou a ser obrigatória para o seu perfil. '
      + 'Ative-a em Segurança para voltar a usar a plataforma.',
    );
  }

  next();
}

// Autenticação OPCIONAL: usada em endpoints públicos que ganham contexto se
// houver sessão (ex.: candidatura ao Supplier Development feita por alguém já
// dentro da plataforma). Nunca bloqueia — sem token válido, segue sem req.user.
async function optionalAuthenticate(req, res, next) {
  if (!tokenDoPedido(req)) return next();
  try {
    await authenticate(req, res, () => {});
  } catch {
    // Token inválido/expirado num endpoint público: ignora-se.
  }
  next();
}

module.exports = { authenticate, optionalAuthenticate };
