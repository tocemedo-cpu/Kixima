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

// Todos os locais de imagem da página de Ajuda (geridos pelo Admin do Sistema).
const IMAGE_SLOTS = [
  { key: 'hero', label: 'Ilustração principal', group: 'Destaque' },
  { key: 'mascot', label: 'Ilustração "Ainda precisa de ajuda?"', group: 'Destaque' },
  { key: 'quick_kb', label: 'Base de Conhecimento', group: 'Atalhos' },
  { key: 'quick_videos', label: 'Vídeos Tutoriais', group: 'Atalhos' },
  { key: 'quick_contact', label: 'Contato com Suporte', group: 'Atalhos' },
  { key: 'quick_tickets', label: 'Tickets Abertos', group: 'Atalhos' },
  ...CATEGORIES.map((c) => ({ key: c.key, label: c.title, group: 'Categorias' })),
  ...CHANNELS.map((c) => ({ key: `channel_${c.key}`, label: c.label, group: 'Canais' })),
];
const SLOT_KEYS = new Set(IMAGE_SLOTS.map((s) => s.key));

async function loadImageMap() {
  const rows = await prisma.supportCategoryImage.findMany();
  return Object.fromEntries(rows.map((i) => [i.key, i.imageUrl]));
}

router.get('/overview', async (req, res) => {
  const [open, imgByKey] = await Promise.all([
    prisma.supportTicket.count({ where: { userId: req.user.id, status: { in: ['ABERTO', 'EM_ANDAMENTO', 'AGUARDANDO_RESPOSTA'] } } }),
    loadImageMap(),
  ]);
  const categories = CATEGORIES.map((c) => ({ ...c, imageUrl: imgByKey[c.key] || null }));
  const channels = CHANNELS.map((c) => ({ ...c, imageUrl: imgByKey[`channel_${c.key}`] || null }));
  res.json({
    categories, channels, hours: HOURS, system: { operational: true },
    images: imgByKey, // hero, mascot, quick_*, channel_*, categorias
    openTickets: open, canManageImages: req.user.role === 'ADMIN_SISTEMA',
  });
});

// Upload da imagem de um local (slot) da página de Ajuda — só o Admin do Sistema.
async function uploadSlotImage(req, res) {
  const { key } = req.params;
  if (!SLOT_KEYS.has(key)) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Local de imagem inválido.' } });
  if (!req.file) return res.status(400).json({ error: { code: 'NO_FILE', message: 'Nenhuma imagem enviada.' } });
  const imageUrl = await storageService.saveFile({
    buffer: req.file.buffer, originalname: req.file.originalname || `${key}.jpg`,
    mimetype: req.file.mimetype, keyHint: `support-${key}`, folder: 'support',
  });
  const row = await prisma.supportCategoryImage.upsert({ where: { key }, create: { key, imageUrl }, update: { imageUrl } });
  res.json(row);
}
router.post('/images/:key', requireRole('ADMIN_SISTEMA'), upload.single('image'), uploadSlotImage);
router.delete('/images/:key', requireRole('ADMIN_SISTEMA'), async (req, res) => {
  await prisma.supportCategoryImage.deleteMany({ where: { key: req.params.key } });
  res.json({ key: req.params.key });
});
// Compatibilidade com o endpoint anterior (categorias).
router.post('/categories/:key/image', requireRole('ADMIN_SISTEMA'), upload.single('image'), uploadSlotImage);

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
  const [counts, imgByKey] = await Promise.all([
    prisma.supportTicket.groupBy({ by: ['status'], _count: { _all: true } }),
    loadImageMap(),
  ]);
  const by = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));
  const total = counts.reduce((s, c) => s + c._count._all, 0);
  res.json({
    categories: CATEGORIES.map((c) => ({ ...c, imageUrl: imgByKey[c.key] || null })),
    channels: CHANNELS, hours: HOURS,
    // Todos os locais de imagem da página, agrupados, com a imagem atual.
    imageSlots: IMAGE_SLOTS.map((s) => ({ ...s, imageUrl: imgByKey[s.key] || null })),
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
