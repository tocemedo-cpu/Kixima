// src/routes/supportRoutes.js
// Ajuda & Suporte — categorias/canais (conteúdo informativo) e pedidos de
// suporte (tickets) do próprio utilizador, persistidos no banco.
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { upload } = require('../config/upload');
const storageService = require('../services/storageService');
const prisma = require('../config/database');

const router = express.Router();
router.use(authenticate);

// Categorias da base de conhecimento e canais — conteúdo institucional.
const CATEGORIES = [
  { key: 'ordens', title: 'Ordens de Compra', desc: 'Guias e soluções', articles: 24, icon: 'orders' },
  { key: 'faturacao', title: 'Faturação', desc: 'Faturas, notas e impostos', articles: 18, icon: 'invoice' },
  { key: 'pagamentos', title: 'Pagamentos', desc: 'Pagamentos e reembolsos', articles: 16, icon: 'payment' },
  { key: 'contratos', title: 'Contratos', desc: 'Contratos e limites', articles: 20, icon: 'contract' },
  { key: 'catalogo', title: 'Catálogo', desc: 'Produtos e serviços', articles: 14, icon: 'catalog' },
  { key: 'desempenho', title: 'Desempenho', desc: 'Avaliações e KPIs', articles: 12, icon: 'chart' },
  { key: 'documentos', title: 'Documentos', desc: 'Upload e gestão', articles: 15, icon: 'contract' },
  { key: 'conta', title: 'Conta & Acesso', desc: 'Utilizadores e permissões', articles: 13, icon: 'users' },
];
const CHANNELS = [
  { key: 'chat', label: 'Chat Online', value: 'Converse connosco', action: 'Iniciar chat', icon: 'help' },
  { key: 'email', label: 'E-mail Support', value: 'suporte@kixima.com', action: 'Enviar e-mail', icon: 'policy' },
  { key: 'telefone', label: 'Telefone', value: '+244 923 456 789', action: 'Ligar agora', icon: 'building' },
  { key: 'whatsapp', label: 'WhatsApp', value: '+244 923 456 789', action: 'Iniciar conversa', icon: 'help' },
];
const HOURS = { label: 'Seg - Sex: 08:00 - 18:00', tz: 'GMT +1 (África/Luanda)', online: true };

router.get('/overview', async (req, res) => {
  const [open, images] = await Promise.all([
    prisma.supportTicket.count({ where: { userId: req.user.id, status: { in: ['ABERTO', 'EM_ANDAMENTO', 'AGUARDANDO_RESPOSTA'] } } }),
    prisma.supportCategoryImage.findMany(),
  ]);
  const imgByKey = Object.fromEntries(images.map((i) => [i.key, i.imageUrl]));
  const categories = CATEGORIES.map((c) => ({ ...c, imageUrl: imgByKey[c.key] || null }));
  res.json({
    categories, channels: CHANNELS, hours: HOURS, system: { operational: true },
    openTickets: open, canManageImages: req.user.role === 'ADMIN_SISTEMA',
  });
});

// Imagem de uma categoria — apenas o Administrador do Sistema pode carregar/trocar.
router.post('/categories/:key/image', requireRole('ADMIN_SISTEMA'), upload.single('image'), async (req, res) => {
  const { key } = req.params;
  if (!CATEGORIES.some((c) => c.key === key)) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Categoria inválida.' } });
  if (!req.file) return res.status(400).json({ error: { code: 'NO_FILE', message: 'Nenhuma imagem enviada.' } });
  const imageUrl = await storageService.saveFile({
    buffer: req.file.buffer, originalname: req.file.originalname || `${key}.jpg`,
    mimetype: req.file.mimetype, keyHint: `support-${key}`, folder: 'support',
  });
  const row = await prisma.supportCategoryImage.upsert({ where: { key }, create: { key, imageUrl }, update: { imageUrl } });
  res.json(row);
});

router.get('/tickets', async (req, res) => {
  const tickets = await prisma.supportTicket.findMany({
    where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 20,
  });
  res.json(tickets);
});

router.post('/tickets', async (req, res) => {
  const subject = String(req.body?.subject || '').trim().slice(0, 160);
  const category = String(req.body?.category || 'Geral').slice(0, 60);
  const message = String(req.body?.message || '').trim().slice(0, 2000);
  if (!subject || !message) {
    return res.status(400).json({ error: { code: 'INVALID', message: 'Assunto e mensagem são obrigatórios.' } });
  }
  const year = new Date().getFullYear();
  const count = await prisma.supportTicket.count();
  const reference = `SUP-${year}-${String(count + 1).padStart(5, '0')}`;
  const ticket = await prisma.supportTicket.create({
    data: { reference, userId: req.user.id, companyId: req.user.companyId || null, subject, category, message },
  });
  res.status(201).json(ticket);
});

// -------------------------------------------------------------------------
// Administração (só ADMIN_SISTEMA) — gerir pedidos de toda a plataforma.
// -------------------------------------------------------------------------
const STATUSES = ['ABERTO', 'EM_ANDAMENTO', 'AGUARDANDO_RESPOSTA', 'RESOLVIDO', 'FECHADO'];

router.get('/admin/overview', requireRole('ADMIN_SISTEMA'), async (req, res) => {
  const [counts, images] = await Promise.all([
    prisma.supportTicket.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.supportCategoryImage.findMany(),
  ]);
  const by = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));
  const total = counts.reduce((s, c) => s + c._count._all, 0);
  const imgByKey = Object.fromEntries(images.map((i) => [i.key, i.imageUrl]));
  res.json({
    categories: CATEGORIES.map((c) => ({ ...c, imageUrl: imgByKey[c.key] || null })),
    channels: CHANNELS, hours: HOURS,
    kpis: {
      total,
      abertos: by.ABERTO || 0,
      emAndamento: by.EM_ANDAMENTO || 0,
      aguardando: by.AGUARDANDO_RESPOSTA || 0,
      resolvidos: by.RESOLVIDO || 0,
      fechados: by.FECHADO || 0,
    },
  });
});

router.get('/admin/tickets', requireRole('ADMIN_SISTEMA'), async (req, res) => {
  const where = {};
  if (req.query.status && STATUSES.includes(req.query.status)) where.status = req.query.status;
  const tickets = await prisma.supportTicket.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 });
  // Junta o autor e a empresa (o modelo guarda apenas os ids).
  const userIds = [...new Set(tickets.map((t) => t.userId))];
  const companyIds = [...new Set(tickets.map((t) => t.companyId).filter(Boolean))];
  const [users, companies] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }),
    prisma.company.findMany({ where: { id: { in: companyIds } }, select: { id: true, name: true } }),
  ]);
  const uById = Object.fromEntries(users.map((u) => [u.id, u]));
  const cById = Object.fromEntries(companies.map((c) => [c.id, c]));
  res.json(tickets.map((t) => ({
    ...t,
    user: uById[t.userId] ? { name: uById[t.userId].name, email: uById[t.userId].email } : null,
    company: t.companyId ? cById[t.companyId]?.name || null : null,
  })));
});

router.patch('/tickets/:id', requireRole('ADMIN_SISTEMA'), async (req, res) => {
  const status = String(req.body?.status || '');
  if (!STATUSES.includes(status)) return res.status(400).json({ error: { code: 'INVALID', message: 'Estado inválido.' } });
  const t = await prisma.supportTicket.update({ where: { id: req.params.id }, data: { status } });
  res.json(t);
});

module.exports = router;
