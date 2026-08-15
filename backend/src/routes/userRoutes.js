// src/routes/userRoutes.js
// Conta do próprio utilizador: obter o perfil e definir a foto (avatar) por
// upload de ficheiro ou captura de câmera (ambos chegam como imagem multipart).
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { upload } = require('../config/upload');
const storageService = require('../services/storageService');
const profileService = require('../services/profileService');
const prisma = require('../config/database');
const dadosPessoais = require('../services/dadosPessoaisService');
const auditService = require('../services/auditService');
const { ValidationError } = require('../utils/errors');

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
// Idioma do utilizador. Guardado no servidor de propósito: a escolha vivia só
// no localStorage do browser, que o servidor não vê — e é o servidor que escreve
// os emails. Sem isto, um utilizador francês recebia tudo em português.
router.put('/me/locale', async (req, res) => {
  const { normalizar, IDIOMAS } = require('../i18n/emails');
  const pedido = String(req.body?.locale || '').toLowerCase();
  if (!IDIOMAS.includes(pedido)) {
    throw new ValidationError(`Idioma inválido. Use um de: ${IDIOMAS.join(', ')}.`);
  }
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { locale: normalizar(pedido) },
    select: { id: true, locale: true },
  });
  res.json(user);
});

// --- Direitos do titular dos dados (Lei 22/11) -------------------------------
// O titular exerce-os sobre a SUA conta; o Admin do Sistema não os exerce por
// ele — o pedido tem de partir de quem os dados dizem respeito.

// Aceder: tudo o que a plataforma sabe sobre esta conta, num único documento.
router.get('/me/dados-pessoais', async (req, res) => {
  const doc = await dadosPessoais.exportar(req.user.id);
  res.setHeader('Content-Disposition', `attachment; filename="kixima-dados-${req.user.id.slice(0, 8)}.json"`);
  res.json(doc);
});

// Eliminar. É uma ANONIMIZAÇÃO, não um DELETE: o trilho financeiro tem de
// sobreviver por obrigação legal, e apagar a linha deixaria ordens sem autor.
// Exige a senha atual — é irreversível e fecha a conta.
router.post('/me/anonimizar', async (req, res) => {
  const bcrypt = require('bcryptjs');
  const eu = await prisma.user.findUnique({ where: { id: req.user.id }, select: { passwordHash: true } });
  const confere = await bcrypt.compare(String(req.body?.password || ''), eu.passwordHash);
  if (!confere) throw new ValidationError('Confirme a sua senha atual para eliminar os dados.');

  // O registo de auditoria é escrito DENTRO da transação do serviço, e já sem
  // nome. Escrevê-lo aqui usaria o ator do token — o nome verdadeiro — e repunha
  // no trilho exatamente aquilo que a operação acabou de remover.
  const resultado = await dadosPessoais.anonimizar(req.user.id, { motivo: req.body?.motivo });
  res.json(resultado);
});

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
