const authService = require('../services/authService');

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

module.exports = { login, me, changePassword, logout, forgotPassword, resetPassword };
