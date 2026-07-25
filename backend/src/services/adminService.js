// src/services/adminService.js
// Administração global (Admin do Sistema): permissões (bloquear/desbloquear
// qualquer utilizador) e gestão de atividades de tudo o que acontece no sistema.
const prisma = require('../config/database');
const { BusinessRuleError, NotFoundError } = require('../utils/errors');

const pretty = (s) => String(s || '').replaceAll('_', ' ').toLowerCase();

async function listUsers() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, active: true, companyId: true, createdAt: true, company: { select: { name: true } } },
    orderBy: [{ active: 'asc' }, { createdAt: 'desc' }],
  });
  return users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, active: u.active, companyName: u.company?.name || null, createdAt: u.createdAt }));
}

// Bloquear/desbloquear qualquer utilizador do sistema.
async function setUserStatus({ id, active, actingUserId }) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundError('Utilizador');
  if (id === actingUserId) throw new BusinessRuleError('Não pode bloquear a própria conta.');
  return prisma.user.update({ where: { id }, data: { active: Boolean(active) }, select: { id: true, name: true, active: true, role: true } });
}

// Feed de atividades de todo o sistema.
async function systemActivities() {
  const [orders, companies, users, payments, tickets, policies, kpis] = await Promise.all([
    prisma.purchaseOrder.findMany({ include: { buyerCompany: { select: { name: true } }, supplierCompany: { select: { name: true } } }, orderBy: { updatedAt: 'desc' }, take: 25 }),
    prisma.company.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
    prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 10, include: { company: { select: { name: true } } } }),
    prisma.payment.findMany({ orderBy: { processedAt: 'desc' }, take: 10 }),
    prisma.supportTicket.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
    prisma.supplierToKiximaPolicy.findMany({ orderBy: { createdAt: 'desc' }, take: 10, include: { company: { select: { name: true } } } }),
    (async () => ({
      empresas: await prisma.company.count(),
      utilizadores: await prisma.user.count(),
      ordens: await prisma.purchaseOrder.count(),
      pagamentos: await prisma.payment.count(),
      tickets: await prisma.supportTicket.count(),
    }))(),
  ]);

  const ev = [];
  for (const o of orders) ev.push({ type: 'Ordem de Compra', module: 'Compras', title: `PO ${o.reference}`, detail: `${pretty(o.status)} — ${o.buyerCompany?.name} → ${o.supplierCompany?.name}`, at: o.updatedAt });
  for (const c of companies) ev.push({ type: 'Empresa', module: 'Credenciamento', title: c.name, detail: `Empresa ${pretty(c.type)} — estado ${pretty(c.status)}`, at: c.createdAt });
  for (const u of users) ev.push({ type: 'Utilizador', module: 'Contas', title: u.name, detail: `Novo ${pretty(u.role)} — ${u.company?.name || '—'}`, at: u.createdAt });
  for (const p of payments) ev.push({ type: 'Pagamento', module: 'Financeiro', title: p.reference, detail: 'Pagamento processado', at: p.processedAt });
  for (const t of tickets) ev.push({ type: 'Suporte', module: 'Ajuda', title: `#${t.reference}`, detail: t.subject, at: t.createdAt });
  for (const pl of policies) ev.push({ type: 'Apólice', module: 'Seguros', title: pl.policyNumber, detail: `${pl.insurer} — ${pl.company?.name || ''}`, at: pl.createdAt });
  ev.sort((a, b) => new Date(b.at) - new Date(a.at));

  return { kpis, items: ev.slice(0, 60) };
}

module.exports = { listUsers, setUserStatus, systemActivities };
