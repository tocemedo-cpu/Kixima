// src/services/profileService.js
// Perfil pessoal — mesmo formato para todas as personas. Devolve o utilizador,
// a empresa e um resumo adequado ao papel (comprador, fornecedor, financeiro,
// admin do sistema) + atividade recente.
const prisma = require('../config/database');

const num = (d) => Number(d ?? 0);
const RECEIVED = ['RECEBIDA_CONFORME', 'RECEBIDA_COM_DIVERGENCIA', 'CONCLUIDA'];
const itemsCount = (po) => po.items.reduce((s, i) => s + i.quantity, 0);

async function getProfile({ userId, companyId }) {
  const [user, company] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, role: true, avatarUrl: true, createdAt: true } }),
    companyId ? prisma.company.findUnique({ where: { id: companyId } }) : null,
  ]);
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);

  // Admin do Sistema — sem empresa: estatísticas da plataforma.
  if (!company) {
    const [companies, orders, policies, users] = await Promise.all([
      prisma.company.count(),
      prisma.purchaseOrder.count(),
      prisma.supplierToKiximaPolicy.count(),
      prisma.user.count(),
    ]);
    return {
      user, company: null, kind: 'admin',
      cards: [
        { icon: 'building', tone: 'info', label: 'Empresas', value: companies, sub: 'Registadas' },
        { icon: 'orders', tone: 'success', label: 'Ordens (plataforma)', value: orders, sub: 'Total' },
        { icon: 'policy', tone: 'pending', label: 'Apólices', value: policies, sub: 'Fornecedores' },
        { icon: 'users', tone: 'info', label: 'Utilizadores', value: users, sub: 'Total' },
      ],
      recent: [],
    };
  }

  const isSupplier = company.type === 'FORNECEDOR';
  const where = isSupplier ? { supplierCompanyId: companyId } : { buyerCompanyId: companyId };
  const orders = await prisma.purchaseOrder.findMany({
    where, include: { items: true, buyerCompany: { select: { name: true } }, supplierCompany: { select: { name: true } } },
    orderBy: { updatedAt: 'desc' },
  });
  const yearOrders = orders.filter((o) => new Date(o.createdAt) >= yearStart);
  const counterpart = new Set(orders.map((o) => (isSupplier ? o.buyerCompanyId : o.supplierCompanyId)));
  const itemsMoved = orders.filter((o) => RECEIVED.includes(o.status)).reduce((s, o) => s + itemsCount(o), 0);
  const totalValue = yearOrders.reduce((s, o) => s + num(o.totalAmount), 0);

  const cards = isSupplier
    ? [
      { icon: 'orders', tone: 'info', label: 'Ordens Recebidas', value: yearOrders.length, sub: 'Este ano' },
      { icon: 'payment', tone: 'success', label: 'Valor Total Vendido', value: totalValue, money: true, sub: 'Este ano' },
      { icon: 'suppliers', tone: 'info', label: 'Clientes', value: counterpart.size, sub: 'Com transações' },
      { icon: 'reception', tone: 'pending', label: 'Itens Entregues', value: itemsMoved, sub: 'Total' },
    ]
    : [
      { icon: 'orders', tone: 'info', label: 'Ordens de Compra', value: yearOrders.length, sub: 'Este ano' },
      { icon: 'payment', tone: 'success', label: 'Valor Total Comprado', value: totalValue, money: true, sub: 'Este ano' },
      { icon: 'suppliers', tone: 'info', label: 'Fornecedores', value: counterpart.size, sub: 'Com transações' },
      { icon: 'reception', tone: 'pending', label: 'Itens Recebidos', value: itemsMoved, sub: 'Total' },
    ];

  const recent = orders.slice(0, 5).map((o) => ({
    reference: o.reference, party: isSupplier ? o.buyerCompany?.name : o.supplierCompany?.name,
    status: o.status, at: o.updatedAt,
  }));

  return { user, company, kind: isSupplier ? 'supplier' : 'buyer', cards, recent };
}

module.exports = { getProfile };
