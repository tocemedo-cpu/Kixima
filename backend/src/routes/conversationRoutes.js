// src/routes/conversationRoutes.js
// Chat Comercial (Comprador ↔ Fornecedor/Prestador) + o painel de Trust &
// Safety que o Suporte usa para as conversas sinalizadas — dois assuntos,
// no mesmo ficheiro, tal como supportRoutes.js já junta o Suporte normal com
// o painel do Admin do Sistema que o gere.
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole, requirePermission } = require('../middleware/rbac');
const { SUPORTE } = require('../utils/adminAreas');
const { uploadDocuments } = require('../config/upload');
const { chatMessageLimiter } = require('../middleware/rateLimit');
const storageService = require('../services/storageService');
const conversationService = require('../services/conversationService');
const riskAlertService = require('../services/riskAlertService');
const { ValidationError } = require('../utils/errors');

const router = express.Router();
router.use(authenticate);

router.get('/unread-count', async (req, res) => {
  res.json({ count: await conversationService.contarNaoLidas(req.user) });
});

router.get('/', async (req, res) => {
  res.json(await conversationService.listarConversas(req.user));
});

router.post('/', async (req, res) => {
  const { otherCompanyId, contextType, contextId } = req.body || {};
  const conversa = await conversationService.iniciar({ user: req.user, otherCompanyId, contextType, contextId }, req);
  res.status(201).json(conversa);
});

router.get('/:id', async (req, res) => {
  res.json(await conversationService.conversationComAcesso(req.params.id, req.user));
});

router.get('/:id/messages', async (req, res) => {
  res.json(await conversationService.listarMensagens(req.params.id, req.user));
});

router.post('/:id/messages', chatMessageLimiter, uploadDocuments.single('attachment'), async (req, res) => {
  let attachmentUrl;
  let attachmentName;
  if (req.file) {
    attachmentUrl = await storageService.saveFile({
      buffer: req.file.buffer, originalname: req.file.originalname,
      mimetype: req.file.mimetype, keyHint: `conversation-msg-${req.params.id}`, folder: 'chat-comercial',
    });
    attachmentName = req.file.originalname;
  }
  const mensagem = await conversationService.enviarMensagem(
    req.params.id, req.user, { body: req.body?.body, attachmentUrl, attachmentName }, req,
  );
  res.status(201).json(mensagem);
});

router.post('/:id/read', async (req, res) => {
  await conversationService.marcarLidas(req.params.id, req.user);
  res.json({ ok: true });
});

// -------------------------------------------------------------------------
// Trust & Safety — só quem gere Suporte (área "suporte" ou Super Admin).
// O acesso a UMA conversa concreta exige, além disto, que ela tenha mesmo um
// alerta — ver riskAlertService.acederConversaSinalizada.
// -------------------------------------------------------------------------

router.get('/admin/alerts', requireRole('ADMIN_SISTEMA'), requirePermission(SUPORTE), async (req, res) => {
  const status = ['ABERTO', 'EM_ANALISE', 'FALSO_POSITIVO', 'RESOLVIDO'].includes(req.query.status) ? req.query.status : undefined;
  res.json(await riskAlertService.listarAlertas({ status }));
});

router.get('/admin/conversations/:id', requireRole('ADMIN_SISTEMA'), requirePermission(SUPORTE), async (req, res) => {
  res.json(await riskAlertService.acederConversaSinalizada(req.params.id, req.user, req));
});

router.patch('/admin/alerts/:id', requireRole('ADMIN_SISTEMA'), requirePermission(SUPORTE), async (req, res) => {
  const { status, decision } = req.body || {};
  if (!status) throw new ValidationError('Indique o novo estado do alerta.');
  res.json(await riskAlertService.reclassificar(req.params.id, req.user, { status, decision }, req));
});

module.exports = router;
