// src/routes/supportRoutes.js
// Ajuda & Suporte — categorias/canais (conteúdo informativo) e pedidos de
// suporte (tickets) do próprio utilizador, persistidos no banco.
const express = require('express');
const fs = require('fs');
const path = require('path');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { upload } = require('../config/upload');
const storageService = require('../services/storageService');
const prisma = require('../config/database');

const router = express.Router();
router.use(authenticate);

// Pasta dos uploads locais (mesmo cálculo do storageService).
const uploadsDir = path.join(__dirname, '../../uploads');

// Um override do admin só conta se ainda existir. Uploads locais (/api/uploads/…)
// ficam em disco efémero — perdem-se em cada deploy no Render. Se o ficheiro já
// não existe, ignoramos o override e voltamos à imagem por omissão (auto-
// recuperação, sem intervenção do admin). URLs http(s)/S3 são consideradas
// persistentes e mantêm-se.
function overrideIsAlive(url) {
  if (!url) return false;
  if (url.startsWith('/api/uploads/')) {
    return fs.existsSync(path.join(uploadsDir, url.replace('/api/uploads/', '')));
  }
  return true;
}

// Base de conhecimento (Perguntas Frequentes) — conteúdo real e visível na
// página. Cada categoria contém apenas as perguntas que existem de facto; a
// contagem apresentada é derivada de `faq.length`, nunca inventada.
const CATEGORIES = [
  {
    key: 'ordens', title: 'Ordens de Compra', desc: 'Criar, aprovar e acompanhar', icon: 'orders',
    faq: [
      { q: 'Como crio uma ordem de compra?', a: 'No menu Pedidos, selecione os produtos a partir do Catálogo, defina as quantidades e submeta a ordem para aprovação.' },
      { q: 'Como acompanho o estado de uma ordem?', a: 'Em Pedidos, cada ordem mostra o seu estado atual (pendente, aprovada, recebida). Abra a ordem para ver o detalhe de cada linha.' },
      { q: 'Posso visualizar a ordem antes de a imprimir?', a: 'Sim. Abra a ordem em Pedidos para a pré-visualizar por completo e só depois imprimir ou exportar.' },
    ],
  },
  {
    key: 'faturacao', title: 'Faturação', desc: 'Faturas e faturação garantida', icon: 'invoice',
    faq: [
      { q: 'O que é a faturação garantida?', a: 'A KIXIMA assegura o pagamento ao fornecedor depois de a receção da mercadoria ser confirmada, reduzindo o risco de crédito da transação.' },
      { q: 'Como visualizo uma fatura antes de imprimir?', a: 'Em Financeiro › Faturas, abra a fatura para a pré-visualizar antes de imprimir ou exportar.' },
      { q: 'Quem emite as faturas?', a: 'O fornecedor emite a fatura associada a uma ordem de compra já recebida.' },
    ],
  },
  {
    key: 'pagamentos', title: 'Pagamentos', desc: 'Registo e histórico', icon: 'payment',
    faq: [
      { q: 'Como registo um pagamento?', a: 'O perfil Financeiro regista o pagamento a partir da fatura correspondente, em Financeiro › Pagamentos.' },
      { q: 'Onde consulto o histórico de pagamentos?', a: 'Em Financeiro › Pagamentos encontra todos os movimentos, com o estado e a data de cada um.' },
    ],
  },
  {
    key: 'contratos', title: 'Contratos', desc: 'Contratos e limites', icon: 'contract',
    faq: [
      { q: 'Como funcionam os limites de um contrato?', a: 'Cada contrato define limites que balizam as ordens de compra permitidas dentro do seu âmbito.' },
      { q: 'Onde consulto os meus contratos?', a: 'No menu Documentação encontra os contratos disponíveis para o seu perfil.' },
    ],
  },
  {
    key: 'catalogo', title: 'Catálogo', desc: 'Pesquisar e publicar', icon: 'catalog',
    faq: [
      { q: 'Como pesquiso no catálogo?', a: 'Em Catálogo, utilize a pesquisa e os filtros por categoria para encontrar produtos e serviços.' },
      { q: 'Como publico um produto? (fornecedor)', a: 'Em Catálogo, use a opção de novo produto e preencha os campos obrigatórios do produto.' },
    ],
  },
  {
    key: 'conta', title: 'Conta & Acesso', desc: 'Utilizadores e permissões', icon: 'users',
    faq: [
      { q: 'Como altero a minha palavra-passe?', a: 'Aceda a Configurações › Conta para atualizar a sua palavra-passe.' },
      { q: 'Quem gere os utilizadores da empresa?', a: 'O administrador da empresa gere os utilizadores e as respetivas permissões de acesso.' },
    ],
  },
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
  { key: 'quick_kb', label: 'Perguntas Frequentes', group: 'Atalhos' },
  { key: 'quick_contact', label: 'Contato com Suporte', group: 'Atalhos' },
  { key: 'quick_tickets', label: 'Tickets Abertos', group: 'Atalhos' },
  ...CATEGORIES.map((c) => ({ key: c.key, label: c.title, group: 'Categorias' })),
  ...CHANNELS.map((c) => ({ key: `channel_${c.key}`, label: c.label, group: 'Canais' })),
];
const SLOT_KEYS = new Set(IMAGE_SLOTS.map((s) => s.key));

// Imagens por omissão de cada local (fornecidas pelo Admin do Sistema e
// versionadas no build em frontend/public/help). Aparecem em toda a plataforma
// sem depender de upload nem de armazenamento externo; um upload do admin
// (guardado em supportCategoryImage) tem prioridade sobre a imagem por omissão.
const DEFAULT_IMAGES = {
  hero: '/help/hero.png',
  mascot: '/help/mascot.png',
  quick_kb: '/help/quick_kb.jpg',
  quick_contact: '/help/quick_contact.png',
  quick_tickets: '/help/quick_tickets.jpg',
  ordens: '/help/ordens.png',
  faturacao: '/help/faturacao.jpg',
  pagamentos: '/help/pagamentos.jpg',
  contratos: '/help/contratos.jpg',
  catalogo: '/help/catalogo.jpg',
  conta: '/help/conta.jpg',
  channel_chat: '/help/channel_chat.jpg',
  channel_email: '/help/channel_email.jpg',
  channel_telefone: '/help/channel_telefone.png',
  channel_whatsapp: '/help/channel_whatsapp.png',
};

async function loadImageMap() {
  const rows = await prisma.supportCategoryImage.findMany();
  const fromDb = {};
  // Só mantém overrides cujo ficheiro ainda existe; os "mortos" (upload efémero
  // apagado num deploy) caem para a imagem por omissão.
  for (const r of rows) if (overrideIsAlive(r.imageUrl)) fromDb[r.key] = r.imageUrl;
  // Defaults primeiro; o upload (válido) do admin sobrepõe-se.
  return { ...DEFAULT_IMAGES, ...fromDb };
}

router.get('/overview', async (req, res) => {
  const [open, imgByKey] = await Promise.all([
    prisma.supportTicket.count({ where: { userId: req.user.id, status: { in: ['ABERTO', 'EM_ANDAMENTO', 'AGUARDANDO_RESPOSTA'] } } }),
    loadImageMap(),
  ]);
  // A contagem apresentada deriva do número real de perguntas da categoria.
  const categories = CATEGORIES.map((c) => ({ ...c, count: c.faq.length, imageUrl: imgByKey[c.key] || null }));
  const channels = CHANNELS.map((c) => ({ ...c, imageUrl: imgByKey[`channel_${c.key}`] || null }));
  res.json({
    categories, channels, hours: HOURS, system: { operational: true },
    faqCount: CATEGORIES.reduce((n, c) => n + c.faq.length, 0),
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
    categories: CATEGORIES.map((c) => ({ ...c, count: c.faq.length, imageUrl: imgByKey[c.key] || null })),
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
