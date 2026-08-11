const express = require('express');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../utils/validate');
const { loginSchema, changePasswordSchema, forgotPasswordSchema, resetPasswordSchema } = require('../utils/schemas');

const router = express.Router();

router.post('/login', validate(loginSchema), authController.login);
// Recuperação de senha — públicas (o token assinado é a autorização). Já estão
// sob o authLimiter de /api/auth (20 pedidos/15 min) contra abuso.
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);
router.get('/me', authenticate, authController.me);
router.patch('/password', authenticate, validate(changePasswordSchema), authController.changePassword);
router.post('/logout', authenticate, authController.logout);

module.exports = router;
