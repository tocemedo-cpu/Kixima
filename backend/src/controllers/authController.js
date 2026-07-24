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

module.exports = { login, me, changePassword };
