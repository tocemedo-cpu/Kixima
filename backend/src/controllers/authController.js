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

module.exports = { login, me, changePassword, logout };
