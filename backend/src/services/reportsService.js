// src/services/reportsService.js
// Relatórios/estatísticas do Fornecedor a partir de dados reais (catálogo + POs).

const prisma = require('../config/database');

// POs cujo pagamento já entrou (receita reconhecida para o fornecedor).
const PAID_STATUSES = ['PAGA', 'EM_EXECUCAO', 'ENTREGUE', 'RECEBIDA_CONFORME', 'RECEBIDA_COM_DIVERGENCIA', 'CONCLUIDA'];

async function supplierStats(supplierCompanyId) {
  const [products, ordersByStatus, revenueAgg, items, viewed] = await Promise.all([
    prisma.product.findMany({
      where: { supplierId: supplierCompanyId },
      select: { active: true, stockQuantity: true, minStock: true },
    }),
    prisma.purchaseOrder.groupBy({
      by: ['status'],
      where: { supplierCompanyId },
      _count: { _all: true },
    }),
    prisma.purchaseOrder.aggregate({
      where: { supplierCompanyId, status: { in: PAID_STATUSES } },
      _sum: { totalAmount: true },
    }),
    prisma.purchaseOrderItem.findMany({
      where: { purchaseOrder: { supplierCompanyId } },
      select: { productId: true, quantity: true, lineTotal: true, product: { select: { name: true } } },
    }),
    prisma.product.findMany({
      where: { supplierId: supplierCompanyId, viewCount: { gt: 0 } },
      select: { id: true, name: true, viewCount: true },
      orderBy: { viewCount: 'desc' },
      take: 10,
    }),
  ]);

  const activeProducts = products.filter((p) => p.active).length;
  const lowStock = products.filter(
    (p) => p.active && p.stockQuantity != null && p.minStock != null && p.stockQuantity <= p.minStock
  ).length;

  const totalOrders = ordersByStatus.reduce((s, g) => s + g._count._all, 0);
  const statusCounts = Object.fromEntries(ordersByStatus.map((g) => [g.status, g._count._all]));

  // Produtos mais vendidos (agregação em memória — volumes de MVP).
  const byProduct = new Map();
  for (const it of items) {
    const cur = byProduct.get(it.productId) || { name: it.product?.name || '—', quantity: 0, total: 0 };
    cur.quantity += it.quantity;
    cur.total += Number(it.lineTotal);
    byProduct.set(it.productId, cur);
  }
  const topProducts = [...byProduct.entries()]
    .map(([productId, v]) => ({ productId, ...v }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  const topViewed = viewed.map((p) => ({ productId: p.id, name: p.name, views: p.viewCount }));
  const totalViews = topViewed.reduce((s, p) => s + p.views, 0);

  return {
    totalProducts: products.length,
    activeProducts,
    lowStock,
    totalOrders,
    statusCounts,
    revenue: Number(revenueAgg._sum.totalAmount || 0),
    totalViews,
    topProducts, // mais vendidos
    topViewed,   // mais vistos
  };
}

module.exports = { supplierStats };
