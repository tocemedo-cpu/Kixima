const authService = require('../services/authService');
const auditService = require('../services/auditService');

// Entrar. O trilho de auditoria cobria as operações com dinheiro mas nada sobre
// AUTENTICAÇÃO: numa transação disputada conseguia-se provar o que aconteceu com
// a ordem, mas não quem estava na conta. Fica registado o sucesso e a falha —
// uma sequência de falhas é o primeiro sinal de um ataque a uma conta concreta.
async function login(req, res) {
  const email = String(req.body?.email || '').trim().toLowerCase();
  try {
    const result = await authService.login(req.body);
    await auditService.recordSafe({
      actor: { ...auditService.anonimoFrom(req), actorId: result.user?.id ?? null, actorName: result.user?.name ?? null, actorRole: result.user?.role ?? null, companyId: result.user?.companyId ?? null },
      action: result.mfaRequired ? 'LOGIN_2FA_PEDIDO' : 'LOGIN_SUCESSO',
      entityType: 'User',
      entityId: result.user?.id ?? null,
      entityRef: email,
      detail: auditService.contextoFrom(req),
    });
    res.json(result);
  } catch (err) {
    // Regista a tentativa e deixa o erro seguir — a resposta ao utilizador não
    // muda, para não revelar se o email existe.
    await auditService.recordSafe({
      actor: auditService.anonimoFrom(req),
      action: 'LOGIN_FALHADO',
      entityType: 'User',
      entityRef: email,
      detail: { ...auditService.contextoFrom(req), motivo: err.code || err.name || 'CREDENCIAIS' },
    });
    throw err;
  }
}

async function me(req, res) {
  res.json({ user: req.user });
}

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  const result = await authService.changePassword(req.user.id, currentPassword, newPassword);
  await auditService.recordSafe({
    actor: auditService.actorFrom(req),
    action: 'SENHA_ALTERADA',
    entityType: 'User',
    entityId: req.user.id,
    entityRef: req.user.email || req.user.name,
    detail: auditService.contextoFrom(req),
  });
  res.json(result);
}

// Termina a sessão em todos os dispositivos (revoga os JWT emitidos).
async function logout(req, res) {
  await authService.revokeSessions(req.user.id);
  await auditService.recordSafe({
    actor: auditService.actorFrom(req),
    action: 'SESSOES_TERMINADAS',
    entityType: 'User',
    entityId: req.user.id,
    entityRef: req.user.email || req.user.name,
    detail: auditService.contextoFrom(req),
  });
  res.json({ ok: true });
}

// Endereço público real do serviço (com trust proxy) — para o link do email.
function publicBaseUrl(req) {
  return `${req.protocol}://${req.get('host')}`;
}

// "Esqueci a senha" — resposta SEMPRE igual, exista o email ou não
// (anti-enumeração de contas).
async function forgotPassword(req, res) {
  await authService.requestPasswordReset(req.body.email, publicBaseUrl(req));
  // Regista-se sempre, exista ou não a conta: a resposta ao utilizador é igual
  // nos dois casos, mas o trilho tem de mostrar quem pediu o quê e de onde.
  await auditService.recordSafe({
    actor: auditService.anonimoFrom(req),
    action: 'SENHA_RECUPERACAO_PEDIDA',
    entityType: 'User',
    entityRef: String(req.body?.email || '').trim().toLowerCase(),
    detail: auditService.contextoFrom(req),
  });
  res.json({ ok: true, message: 'Se o email existir na plataforma, enviámos um link de recuperação.' });
}

async function resetPassword(req, res) {
  const result = await authService.resetPassword(req.body.token, req.body.password);
  await auditService.recordSafe({
    actor: { ...auditService.anonimoFrom(req), actorId: result?.userId ?? null },
    action: 'SENHA_REPOSTA',
    entityType: 'User',
    entityId: result?.userId ?? null,
    entityRef: result?.email ?? null,
    detail: auditService.contextoFrom(req),
  });
  res.json(result);
}

// --- 2FA (TOTP) -------------------------------------------------------------

async function totpStatus(req, res) {
  res.json(await authService.totpStatus(req.user.id));
}

// Ativação por email: envia o código de 6 dígitos para o endereço da conta.
async function mfaEnviarCodigo(req, res) {
  res.json(await authService.enviarCodigoAtivacao(req.user.id));
}

// Reenvio a partir do ecrã de login — ainda sem sessão, só com o desafio.
async function mfaReenviarCodigo(req, res) {
  res.json(await authService.reenviarCodigoDoDesafio(req.body.challenge));
}

// Reenvio já dentro da sessão (para desativar a 2FA por email).
async function mfaReenviarCodigoSessao(req, res) {
  const prisma = require('../config/database');
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  res.json(await authService.reenviarCodigo(user));
}

async function totpSetup(req, res) {
  res.json(await authService.setupTotp(req.user.id));
}

async function totpEnable(req, res) {
  const result = await authService.enableTotp(req.user.id, req.body.code);
  await auditService.recordSafe({
    actor: auditService.actorFrom(req),
    action: 'MFA_ATIVADA',
    entityType: 'User',
    entityId: req.user.id,
    entityRef: req.user.name,
  });
  res.json(result);
}

async function totpDisable(req, res) {
  const result = await authService.disableTotp(req.user.id, req.body.code);
  await auditService.recordSafe({
    actor: auditService.actorFrom(req),
    action: 'MFA_DESATIVADA',
    entityType: 'User',
    entityId: req.user.id,
    entityRef: req.user.name,
  });
  res.json(result);
}

// 2º passo do login (público): desafio + código TOTP → sessão completa.
async function totpVerify(req, res) {
  res.json(await authService.verify2fa(req.body.challenge, req.body.code));
}

module.exports = {
  login, me, changePassword, logout, forgotPassword, resetPassword,
  totpStatus, totpSetup, totpEnable, totpDisable, totpVerify,
  mfaEnviarCodigo, mfaReenviarCodigo, mfaReenviarCodigoSessao,
};
