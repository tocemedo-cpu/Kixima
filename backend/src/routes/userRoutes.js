// src/routes/userRoutes.js
// Conta do próprio utilizador: obter o perfil e definir a foto (avatar) por
// upload de ficheiro ou captura de câmera (ambos chegam como imagem multipart).
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { upload } = require('../config/upload');
const storageService = require('../services/storageService');
const profileService = require('../services/profileService');
const prisma = require('../config/database');

const router = express.Router();
router.use(authenticate);

const PUBLIC = { id: true, name: true, email: true, role: true, avatarUrl: true, companyId: true, createdAt: true };

router.get('/me', async (req, res) => {
  res.json(await prisma.user.findUnique({ where: { id: req.user.id }, select: PUBLIC }));
});

// Perfil pessoal — mesmo formato para todas as personas.
router.get('/profile', async (req, res) => {
  res.json(await profileService.getProfile({ userId: req.user.id, companyId: req.user.companyId }));
});

// Foto de perfil. O front envia a imagem no campo `image` (ficheiro escolhido
// ou frame capturado pela câmera convertido em blob).
router.post('/me/avatar', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: { code: 'NO_FILE', message: 'Nenhuma imagem enviada.' } });
  const avatarUrl = await storageService.saveFile({
    buffer: req.file.buffer, originalname: req.file.originalname || 'avatar.jpg',
    mimetype: req.file.mimetype, keyHint: `avatar-${req.user.id}`, folder: 'avatars',
  });
  const user = await prisma.user.update({ where: { id: req.user.id }, data: { avatarUrl }, select: PUBLIC });
  res.json(user);
});

router.delete('/me/avatar', async (req, res) => {
  const user = await prisma.user.update({ where: { id: req.user.id }, data: { avatarUrl: null }, select: PUBLIC });
  res.json(user);
});

module.exports = router;
