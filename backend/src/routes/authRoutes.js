const express = require('express');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../utils/validate');
const {
  loginSchema, changePasswordSchema, forgotPasswordSchema, resetPasswordSchema,
  totpCodeSchema, totpVerifySchema, reenviarCodigoSchema,
} = require('../utils/schemas');

const router = express.Router();

router.post('/login', validate(loginSchema), authController.login);
// Recuperação de senha — públicas (o token assinado é a autorização). Já estão
// sob o authLimiter de /api/auth (20 pedidos/15 min) contra abuso.
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);
// 2º passo do login com 2FA — público (o desafio assinado é a autorização).
router.post('/2fa/verify', validate(totpVerifySchema), authController.totpVerify);
// Reenviar o código por email a partir do ecrã de login: ainda não há sessão,
// e o desafio assinado é o que prova que a senha já foi validada.
router.post('/2fa/reenviar', validate(reenviarCodigoSchema), authController.mfaReenviarCodigo);
router.get('/me', authenticate, authController.me);
router.patch('/password', authenticate, validate(changePasswordSchema), authController.changePassword);
router.post('/logout', authenticate, authController.logout);
// Gestão da verificação em dois passos — sessão autenticada.
router.get('/2fa/status', authenticate, authController.totpStatus);
// Método EMAIL (por omissão): pedir o código de ativação, e pedir um novo.
router.post('/2fa/email/enviar', authenticate, authController.mfaEnviarCodigo);
router.post('/2fa/email/reenviar', authenticate, authController.mfaReenviarCodigoSessao);
// Método TOTP (app de autenticação), para quem prefira.
router.post('/2fa/setup', authenticate, authController.totpSetup);
router.post('/2fa/enable', authenticate, validate(totpCodeSchema), authController.totpEnable);
router.post('/2fa/disable', authenticate, validate(totpCodeSchema), authController.totpDisable);

module.exports = router;
