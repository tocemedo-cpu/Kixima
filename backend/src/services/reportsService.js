// src/services/reportsService.js
// Relatórios/estatísticas do Fornecedor a partir de dados reais (catálogo + POs).

const prisma = require('../config/database');
const planService = require('./planService');

// POs cujo pagamento já entrou (receita reconhecida para o fornecedor).
const PAID_STATUSES = ['PAGA', 'EM_EXECUCAO', 'ENTREGUE', 'RECEBIDA_CONFORME', 'RECEBIDA_COM_DIVERGENCIA', 'CONCLUIDA'];

/**
 * A janela de histórico que este relatório pode mostrar.
 *
 * A matriz de planos vende 3 meses no BASE, 12 no CORE e tudo no Pro. Até aqui
 * era uma promessa que não existia em lado nenhum: o relatório agregava desde
 * sempre, para toda a gente. Não era um limite mal aplicado — era um limite que
 * nunca chegou a ser escrito.
 *
 * Quem pede menos do que o plano permite, recebe o que pediu. Quem pede mais,
 * recebe o que o plano dá — e o relatório DIZ qual foi a janela aplicada, para
 * o número não aparecer mais baixo do que a pessoa espera sem explicação.
 */
function janelaDoPlano(plan, mesesPedidos) {
  const limite = planService.limite(plan, 'historicoRelatoriosMeses');
  const pedido = Number(mesesPedidos);
  const pedidoValido = Number.isFinite(pedido) && pedido > 0 ? Math.floor(pedido) : null;

  if (limite === planService.ILIMITADO) {
    return { meses: pedidoValido, ilimitado: !pedidoValido, limitePlano: null, truncada: false };
  }
  const meses = pedidoValido ? Math.min(pedidoValido, limite) : limite;
  return {
    meses,
    ilimitado: false,
    limitePlano: limite,
    truncada: Boolean(pedidoValido && pedidoValido > limite),
  };
}

// Data de corte para a janela, ou null quando não há janela.
function cortePara(janela, agora) {
  if (!janela.meses) return null;
  const d = new Date(agora);
  d.setMonth(d.getMonth() - janela.meses);
  return d;
}

async function supplierStats(supplierCompanyId, { meses, agora = new Date(), plan } = {}) {
  const empresa = plan !== undefined
    ? { plan }
    : await prisma.company.findUnique({ where: { id: supplierCompanyId }, select: { plan: true } });

  const janela = janelaDoPlano(empresa?.plan, meses);
  const corte = cortePara(janela, agora);
  // Só o que é DATADO entra na janela. O catálogo é estado presente (quantos
  // produtos tem hoje) e não faz sentido cortá-lo por data.
  const desde = corte ? { createdAt: { gte: corte } } : {};
  const [products, ordersByStatus, revenueAgg, items, viewed] = await Promise.all([
    prisma.product.findMany({
      where: { supplierId: supplierCompanyId },
      select: { active: true, stockQuantity: true, minStock: true },
    }),
    prisma.purchaseOrder.groupBy({
      by: ['status'],
      where: { supplierCompanyId, ...desde },
      _count: { _all: true },
    }),
    prisma.purchaseOrder.aggregate({
      where: { supplierCompanyId, status: { in: PAID_STATUSES }, ...desde },
      _sum: { totalAmount: true },
    }),
    prisma.purchaseOrderItem.findMany({
      where: { purchaseOrder: { supplierCompanyId, ...desde } },
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
    // A janela que foi mesmo aplicada. Vai na resposta porque um total mais
    // baixo do que o esperado, sem dizer que período cobre, é indistinguível
    // de um erro de cálculo — e é a interface que tem de o explicar.
    janela: {
      meses: janela.meses,
      ilimitado: janela.ilimitado,
      limitePlano: janela.limitePlano,
      truncada: janela.truncada,
      desde: corte ? corte.toISOString() : null,
      // Estes números NÃO respeitam a janela, e é preciso dizê-lo: o catálogo é
      // estado presente, e `viewCount` é um contador corrido sem datas — não há
      // por onde cortá-lo sem passar a inventar. Marcado aqui em vez de ficar
      // uma diferença silenciosa entre dois números no mesmo ecrã.
      semJanela: ['totalProducts', 'activeProducts', 'lowStock', 'totalViews', 'topViewed'],
    },
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

module.exports = { supplierStats, janelaDoPlano };
