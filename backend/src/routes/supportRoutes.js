// src/routes/supportRoutes.js
// Ajuda & Suporte — categorias/canais (conteúdo informativo) e pedidos de
// suporte (tickets) do próprio utilizador, persistidos no banco.
const express = require('express');
const { authenticate } = require('../middleware/auth');
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
  const open = await prisma.supportTicket.count({
    where: { userId: req.user.id, status: { in: ['ABERTO', 'EM_ANDAMENTO', 'AGUARDANDO_RESPOSTA'] } },
  });
  res.json({ categories: CATEGORIES, channels: CHANNELS, hours: HOURS, system: { operational: true }, openTickets: open });
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

module.exports = router;
