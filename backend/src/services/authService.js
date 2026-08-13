// src/services/authService.js

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const config = require('../config/env');
const mfaPolicy = require('./mfaPolicy');
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

  // 2FA ativa: a senha não basta. Devolve um desafio de curta duração; o token
  // de sessão só sai no /2fa/verify com um código válido.
  if (user.totpEnabledAt) {
    const challenge = jwt.sign(
      { t: '2fa', sub: user.id, tv: user.tokenVersion ?? 0 },
      config.auth.jwtSecret,
      { expiresIn: TWO_FA_CHALLENGE_TTL },
    );
    const metodo = user.mfaMethod || 'TOTP';
    if (metodo !== 'EMAIL') return { requires2fa: true, metodo, challenge };

    // Método EMAIL: o código é enviado agora. Se o envio falhar, dizemos —
    // engolir o erro deixaria a pessoa à espera de um código que não existe,
    // sem forma nenhuma de entrar.
    const envio = await mfaEmail.enviarCodigo(user, { automatico: true });
    return { requires2fa: true, metodo, challenge, ...envio };
  }

  return buildSession(user);
}

// Sessão completa (token + payload do utilizador) — partilhada por login e 2FA.
function buildSession(user) {
  // Estado da 2FA obrigatória: a interface precisa de saber se deve avisar
  // (pendente) ou se a conta já está limitada até a ativar (restrita).
  const mfa = mfaPolicy.estadoPara(user);
  return {
    token: signToken(user),
    mfaPendente: mfa.pendente,
    mfaRestrita: mfa.restrita,
    mfaPrazo: mfa.prazo,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      companyName: user.company?.name ?? null,
      companyType: user.company?.type ?? null,
      avatarUrl: user.avatarUrl ?? null,
    },
  };
}

// --- 2FA (TOTP) -------------------------------------------------------------
const totpUtil = require('../utils/totp');
const mfaEmail = require('./mfaEmailService');
// Curto de propósito: é só o tempo de ir buscar o código e voltar. Com o método
// EMAIL dá folga suficiente — o código dura 10 minutos, mas o desafio não.
const TWO_FA_CHALLENGE_TTL = '15m';

async function totpStatus(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpEnabledAt: true, mfaMethod: true, email: true },
  });
  return {
    enabled: Boolean(user?.totpEnabledAt),
    enabledAt: user?.totpEnabledAt ?? null,
    metodo: user?.totpEnabledAt ? (user.mfaMethod || 'TOTP') : null,
    // A interface precisa de saber se o email está mesmo a funcionar ANTES de
    // deixar ativar: sem isso, a pessoa ativava e ficava trancada fora.
    emailIndisponivel: mfaEmail.porqueNaoPodeUsarEmail(),
    email: user?.email ? mfaEmail.mascarar(user.email) : null,
  };
}

// --- Ativação por EMAIL (método por omissão) --------------------------------
// Passo 1: envia um código para o email da pessoa.
async function enviarCodigoAtivacao(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new UnauthorizedError('Sessão inválida.');
  if (user.totpEnabledAt) throw new ConflictError('A verificação em dois passos já está ativa.');
  return mfaEmail.enviarCodigo(user, { motivo: 'ativacao' });
}

// --- Ativação por APP (TOTP) ------------------------------------------------
// Mantido para quem prefira a app: o código nasce no telemóvel, sem rede e sem
// passar por lado nenhum. É mais seguro do que o email — mas obriga a instalar
// e configurar uma aplicação, e por isso não é o caminho por omissão.
async function setupTotp(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new UnauthorizedError('Sessão inválida.');
  if (user.totpEnabledAt) throw new ConflictError('A verificação em dois passos já está ativa.');

  const secret = totpUtil.generateSecret();
  await prisma.user.update({ where: { id: userId }, data: { totpSecret: secret, totpEnabledAt: null } });
  return { secret, otpauthUrl: totpUtil.otpauthUrl({ secret, label: user.email }) };
}

// Passo 2 (ambos os métodos): a pessoa prova que recebe os códigos — só então
// a 2FA fica ativa. O método fica gravado, porque é ele que decide o que lhe
// vai ser pedido no login.
async function enableTotp(userId, code) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new UnauthorizedError('Sessão inválida.');
  if (user.totpEnabledAt) throw new ConflictError('A verificação em dois passos já está ativa.');

  // Há um código de email pendente → é uma ativação por email.
  if (user.mfaCodeHash) {
    const problema = await mfaEmail.confirmarCodigo(user, code);
    if (problema) throw new UnauthorizedError(problema);
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { totpEnabledAt: new Date(), mfaMethod: 'EMAIL', totpSecret: null },
    });
    return { enabled: true, enabledAt: updated.totpEnabledAt, metodo: 'EMAIL' };
  }

  if (!user.totpSecret) {
    throw new ConflictError('Inicie primeiro a ativação (pedir o código por email ou gerar o código QR).');
  }
  if (!totpUtil.verify(code, user.totpSecret)) {
    // "Código incorreto" é verdade e não ajuda: a causa quase sempre é o relógio
    // do telemóvel fora de horas. Aqui diz-se qual é o desvio, em vez de deixar
    // a pessoa a reinstalar a app e a falhar na mesma.
    throw new UnauthorizedError(totpUtil.explicarFalha(code, user.totpSecret));
  }
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { totpEnabledAt: new Date(), mfaMethod: 'TOTP' },
  });
  return { enabled: true, enabledAt: updated.totpEnabledAt, metodo: 'TOTP' };
}

// Desativar exige um código válido (impede desativação por sessão roubada).
// Com o método EMAIL o código tem de ser pedido primeiro.
async function disableTotp(userId, code) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.totpEnabledAt) throw new ConflictError('A verificação em dois passos não está ativa.');

  const problema = await confirmarSegundoFator(user, code);
  if (problema) throw new UnauthorizedError(problema);

  await prisma.user.update({
    where: { id: userId },
    data: { totpSecret: null, totpEnabledAt: null, mfaMethod: null, mfaCodeHash: null, mfaCodeExpiraEm: null },
  });
  return { enabled: false };
}

// Pede um código novo para uma conta que JÁ tem a 2FA por email — no login
// (via desafio) ou já dentro da sessão, para desativar.
async function reenviarCodigo(user) {
  if ((user.mfaMethod || 'TOTP') !== 'EMAIL') {
    throw new ConflictError('Esta conta usa a app de autenticação — o código é gerado no telemóvel.');
  }
  return mfaEmail.enviarCodigo(user);
}

/**
 * Confirma o segundo fator, seja qual for o método configurado.
 * Devolve null se serve, ou a razão pela qual não serve.
 */
async function confirmarSegundoFator(user, code) {
  if ((user.mfaMethod || 'TOTP') === 'EMAIL') {
    return mfaEmail.confirmarCodigo(user, code);
  }
  if (!totpUtil.verify(code, user.totpSecret)) {
    return totpUtil.explicarFalha(code, user.totpSecret);
  }
  return null;
}

// Lê o desafio do 2º passo do login e devolve o utilizador a que pertence.
async function utilizadorDoDesafio(challenge) {
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
  return user;
}

// 2º passo do login: troca desafio + código pela sessão completa.
async function verify2fa(challenge, code) {
  const user = await utilizadorDoDesafio(challenge);
  if (!user.totpEnabledAt) {
    throw new UnauthorizedError('Esta conta não tem verificação em dois passos. Volte a iniciar sessão.');
  }
  const problema = await confirmarSegundoFator(user, code);
  if (problema) throw new UnauthorizedError(problema);
  return buildSession(user);
}

// Reenvio a partir do ecrã de login (ainda sem sessão) — só com um desafio válido.
async function reenviarCodigoDoDesafio(challenge) {
  const user = await utilizadorDoDesafio(challenge);
  return reenviarCodigo(user);
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
  // userId/email devolvidos para o trilho de auditoria poder identificar a conta:
  // quem repõe a senha não está autenticado, logo não há req.user.
  return { ok: true, userId: user.id, email: user.email };
}

module.exports = {
  login, createUser, hashPassword, signToken, signInvite, verifyInvite,
  changePassword, revokeSessions, requestPasswordReset, resetPassword,
  totpStatus, setupTotp, enableTotp, disableTotp, verify2fa,
  enviarCodigoAtivacao, reenviarCodigo, reenviarCodigoDoDesafio,
};
