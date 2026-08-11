const authService = require('../services/authService');
const auditService = require('../services/auditService');

async function login(req, res) {
  const result = await authService.login(req.body);
  res.json(result);
}

async function me(req, res) {
  res.json({ user: req.user });
}

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  const result = await authService.changePassword(req.user.id, currentPassword, newPassword);
  res.json(result);
}

// Termina a sessão em todos os dispositivos (revoga os JWT emitidos).
async function logout(req, res) {
  await authService.revokeSessions(req.user.id);
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
  res.json({ ok: true, message: 'Se o email existir na plataforma, enviámos um link de recuperação.' });
}

async function resetPassword(req, res) {
  res.json(await authService.resetPassword(req.body.token, req.body.password));
}

// --- 2FA (TOTP) -------------------------------------------------------------

async function totpStatus(req, res) {
  res.json(await authService.totpStatus(req.user.id));
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
};
