// src/services/buyerService.js
// Agregações de leitura para as telas do Comprador (Ordens, Pagamentos,
// Acompanhar Entrega, Recepção, Fornecedores, Atividades e Perfil). Tudo
// derivado dos dados reais de PurchaseOrder / Invoice / Company / Notification.
const prisma = require('../config/database');

const SUPPLIER_SEL = { select: { id: true, name: true, logoUrl: true, verified: true, city: true, province: true, country: true } };
const PO_INCLUDE = {
  items: { include: { product: { select: { id: true, name: true, sku: true } } } },
  invoice: { include: { payment: true } },
  supplierCompany: SUPPLIER_SEL,
};

// Conjuntos de estados usados nas várias vistas.
const ACTIVE = ['AGUARDANDO_APROVACAO', 'APROVADA', 'ACEITE_FORNECEDOR', 'AGUARDANDO_PAGAMENTO', 'PAGA', 'EM_EXECUCAO', 'ENTREGUE'];
const RECEIVED = ['RECEBIDA_CONFORME', 'RECEBIDA_COM_DIVERGENCIA', 'CONCLUIDA'];
const CANCELLED = ['REJEITADA', 'RECUSADA_FORNECEDOR'];

function num(d) { return Number(d ?? 0); }
function itemsCount(po) { return po.items.reduce((s, i) => s + i.quantity, 0); }

// ---------------------------------------------------------------------------
// Ordens de Compra (item 6)
// ---------------------------------------------------------------------------
async function orders({ buyerCompanyId, status, q, page = 1, limit = 10 }) {
  const where = { buyerCompanyId };
  if (status === 'ANDAMENTO') where.status = { in: ['APROVADA', 'ACEITE_FORNECEDOR', 'AGUARDANDO_PAGAMENTO', 'PAGA', 'EM_EXECUCAO', 'ENTREGUE'] };
  else if (status === 'CONCLUIDAS') where.status = { in: RECEIVED };
  else if (status === 'CANCELADAS') where.status = { in: CANCELLED };
  else if (status) where.status = status;
  if (q) where.OR = [
    { reference: { contains: q, mode: 'insensitive' } },
    { supplierCompany: { is: { name: { contains: q, mode: 'insensitive' } } } },
  ];

  const [all, rows] = await Promise.all([
    prisma.purchaseOrder.findMany({ where: { buyerCompanyId }, select: { status: true, totalAmount: true } }),
    prisma.purchaseOrder.findMany({
      where, include: PO_INCLUDE, orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit, take: limit,
    }),
  ]);

  const kpis = {
    total: all.length,
    valorTotal: all.reduce((s, p) => s + num(p.totalAmount), 0),
    emAndamento: all.filter((p) => ACTIVE.includes(p.status) && p.status !== 'AGUARDANDO_APROVACAO').length,
    concluidas: all.filter((p) => RECEIVED.includes(p.status)).length,
    canceladas: all.filter((p) => CANCELLED.includes(p.status)).length,
  };
  const total = await prisma.purchaseOrder.count({ where });
  return { kpis, items: rows.map(shapeOrder), total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

function shapeOrder(po) {
  return {
    id: po.id, reference: po.reference, status: po.status,
    supplier: po.supplierCompany, itemsCount: itemsCount(po),
    totalAmount: num(po.totalAmount), currency: po.currency,
    isCallOff: po.isCallOff, createdAt: po.createdAt, acceptedAt: po.acceptedAt,
    paymentDueAt: po.paymentDueAt, dispatchedAt: po.dispatchedAt,
    deliveredAt: po.deliveredAt, receivedAt: po.receivedAt, receptionStatus: po.receptionStatus,
  };
}

// ---------------------------------------------------------------------------
// Pagamentos (item 7)
// ---------------------------------------------------------------------------
async function payments({ buyerCompanyId, status, q }) {
  const orders = await prisma.purchaseOrder.findMany({
    where: { buyerCompanyId, invoice: { isNot: null } },
    include: PO_INCLUDE, orderBy: { createdAt: 'desc' },
  });

  let rows = orders.map((po) => {
    const inv = po.invoice;
    const paid = inv.status === 'PAGA';
    return {
      id: inv.id, poId: po.id, reference: po.reference, invoiceRef: inv.reference,
      supplier: po.supplierCompany, poDate: po.createdAt, dueAt: inv.dueAt,
      amount: num(inv.amount), paid: paid ? num(inv.amount) : (inv.payment ? num(inv.payment.amount) : 0),
      open: paid ? 0 : num(inv.amount), status: inv.status, currency: inv.currency,
      origin: po.isCallOff ? 'Call-off' : 'Gerada a partir do Checkout',
    };
  });
  if (status === 'ABERTO') rows = rows.filter((r) => r.status === 'PENDENTE');
  else if (status === 'ATRASADO') rows = rows.filter((r) => r.status === 'VENCIDA');
  else if (status === 'CONCLUIDO') rows = rows.filter((r) => r.status === 'PAGA');
  if (q) rows = rows.filter((r) => r.reference.toLowerCase().includes(q.toLowerCase()) || r.supplier?.name?.toLowerCase().includes(q.toLowerCase()));

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const all = orders.map((po) => po.invoice);
  const kpis = {
    aPagar: all.filter((i) => i.status === 'PENDENTE').reduce((s, i) => s + num(i.amount), 0),
    concluidos: all.filter((i) => i.status === 'PAGA' && new Date(i.updatedAt) >= monthStart).reduce((s, i) => s + num(i.amount), 0),
    atrasados: all.filter((i) => i.status === 'VENCIDA').reduce((s, i) => s + num(i.amount), 0),
    totalPO: orders.reduce((s, po) => s + num(po.totalAmount), 0),
  };
  return { kpis, items: rows };
}

// ---------------------------------------------------------------------------
// Acompanhar Entrega (item 8)
// ---------------------------------------------------------------------------
function deliveryStage(po) {
  if (po.receivedAt) return { stage: 'ENTREGUE', label: 'Entregue', progress: 100 };
  if (po.deliveredAt) return { stage: 'ENTREGUE', label: 'Entregue', progress: 100 };
  if (po.dispatchedAt) return { stage: 'EM_TRANSITO', label: 'Em Trânsito', progress: 75 };
  return { stage: 'EM_PREPARACAO', label: 'Em Preparação', progress: 30 };
}
async function deliveries({ buyerCompanyId, stage, q }) {
  const orders = await prisma.purchaseOrder.findMany({
    where: { buyerCompanyId, status: { in: ['PAGA', 'EM_EXECUCAO', 'ENTREGUE', ...RECEIVED, ...CANCELLED] } },
    include: PO_INCLUDE, orderBy: { createdAt: 'desc' },
  });
  let rows = orders.map((po) => {
    const d = CANCELLED.includes(po.status) ? { stage: 'CANCELADA', label: 'Cancelada', progress: 0 } : deliveryStage(po);
    return {
      id: po.id, reference: po.reference, supplier: po.supplierCompany, itemsCount: itemsCount(po),
      emittedAt: po.createdAt, dispatchedAt: po.dispatchedAt, deliveredAt: po.deliveredAt,
      ...d, location: po.supplierCompany?.city ? `${po.supplierCompany.city}, ${po.supplierCompany.country || 'Angola'}` : '—',
    };
  });
  if (stage && stage !== 'TODAS') rows = rows.filter((r) => r.stage === stage);
  if (q) rows = rows.filter((r) => r.reference.toLowerCase().includes(q.toLowerCase()) || r.supplier?.name?.toLowerCase().includes(q.toLowerCase()));

  const src = orders.map((po) => (CANCELLED.includes(po.status) ? { stage: 'CANCELADA' } : deliveryStage(po)));
  const kpis = {
    emTransito: src.filter((s) => s.stage === 'EM_TRANSITO').length,
    emPreparacao: src.filter((s) => s.stage === 'EM_PREPARACAO').length,
    entregues: src.filter((s) => s.stage === 'ENTREGUE').length,
    canceladas: src.filter((s) => s.stage === 'CANCELADA').length,
  };
  return { kpis, items: rows };
}

// ---------------------------------------------------------------------------
// Recepção (item 9)
// ---------------------------------------------------------------------------
async function receptions({ buyerCompanyId, status, q }) {
  const orders = await prisma.purchaseOrder.findMany({
    where: { buyerCompanyId, status: { in: ['ENTREGUE', ...RECEIVED] } },
    include: PO_INCLUDE, orderBy: { updatedAt: 'desc' },
  });
  let rows = orders.flatMap((po) => po.items.map((it) => {
    let st = 'A_RECEBER';
    if (po.status === 'RECEBIDA_CONFORME' || po.status === 'CONCLUIDA') st = 'RECEBIDO';
    else if (po.status === 'RECEBIDA_COM_DIVERGENCIA') st = 'DIVERGENCIA';
    return {
      id: `${po.id}:${it.id}`, poId: po.id, reference: po.reference, supplier: po.supplierCompany,
      item: it.product?.name, sku: it.product?.sku, quantity: it.quantity,
      receivedAt: po.receivedAt, status: st, receptionStatus: po.receptionStatus,
    };
  }));
  if (status && status !== 'TODOS') rows = rows.filter((r) => r.status === status);
  if (q) rows = rows.filter((r) => r.reference.toLowerCase().includes(q.toLowerCase()) || r.supplier?.name?.toLowerCase().includes(q.toLowerCase()) || (r.item || '').toLowerCase().includes(q.toLowerCase()));

  const flat = orders.flatMap((po) => po.items.map(() => po.status));
  const kpis = {
    aReceber: flat.filter((s) => s === 'ENTREGUE').length,
    recebidos: flat.filter((s) => s === 'RECEBIDA_CONFORME' || s === 'CONCLUIDA').length,
    divergencia: flat.filter((s) => s === 'RECEBIDA_COM_DIVERGENCIA').length,
    total: flat.length,
  };
  return { kpis, items: rows };
}

// ---------------------------------------------------------------------------
// Fornecedores (item 10)
// ---------------------------------------------------------------------------
async function suppliers({ buyerCompanyId, status, q }) {
  const companies = await prisma.company.findMany({
    where: { type: 'FORNECEDOR', status: { in: ['APROVADA', 'PENDENTE'] }, ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}) },
    orderBy: { createdAt: 'desc' },
  });
  const rows = await Promise.all(companies.map(async (c) => {
    const [agg, lastPo] = await Promise.all([
      prisma.product.aggregate({ where: { supplierId: c.id, active: true }, _avg: { rating: true }, _count: { _all: true } }),
      prisma.purchaseOrder.findFirst({
        where: { supplierCompanyId: c.id, buyerCompanyId },
        orderBy: { createdAt: 'desc' }, select: { reference: true, createdAt: true },
      }),
    ]);
    const topProduct = await prisma.product.groupBy({
      by: ['category'], where: { supplierId: c.id, active: true }, _count: { _all: true },
      orderBy: { _count: { category: 'desc' } }, take: 1,
    });
    return {
      id: c.id, name: c.name, logoUrl: c.logoUrl, verified: c.verified, status: c.status,
      city: c.city, country: c.country, category: topProduct[0]?.category || '—',
      rating: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : null,
      productCount: agg._count._all, lastTransaction: lastPo || null,
    };
  }));
  let list = rows;
  if (status === 'HOMOLOGADOS') list = rows.filter((r) => r.verified);
  else if (status === 'AVALIACAO') list = rows.filter((r) => !r.verified);
  else if (status === 'ATIVOS') list = rows.filter((r) => r.status === 'APROVADA');

  const now = new Date(); const d30 = new Date(now.getTime() - 30 * 864e5);
  const kpis = {
    total: rows.length,
    ativos: rows.filter((r) => r.status === 'APROVADA').length,
    homologados: rows.filter((r) => r.verified).length,
    emAvaliacao: rows.filter((r) => !r.verified).length,
    novos: companies.filter((c) => new Date(c.createdAt) >= d30).length,
  };
  return { kpis, items: list };
}

// ---------------------------------------------------------------------------
// Atividades (item 11)
// ---------------------------------------------------------------------------
async function activities({ buyerCompanyId, filter }) {
  const orders = await prisma.purchaseOrder.findMany({
    where: { buyerCompanyId }, include: PO_INCLUDE, orderBy: { updatedAt: 'desc' },
  });
  const tasks = [];
  for (const po of orders) {
    const base = { relatedTo: po.reference, poId: po.id, supplier: po.supplierCompany?.name, at: po.updatedAt };
    if (po.status === 'AGUARDANDO_APROVACAO') tasks.push({ ...base, type: 'APROVAR', title: 'Aprovar Ordem de Compra', desc: 'Rever e aprovar a PO antes do envio ao fornecedor.', status: 'PENDENTE', priority: 'ALTA' });
    else if (po.status === 'AGUARDANDO_PAGAMENTO' || (po.invoice && po.invoice.status === 'PENDENTE')) tasks.push({ ...base, type: 'PAGAR', title: 'Autorizar Pagamento', desc: 'Rever e autorizar o pagamento da fatura.', status: 'PENDENTE', priority: 'ALTA' });
    else if (po.status === 'ENTREGUE') tasks.push({ ...base, type: 'RECEBER', title: 'Confirmar Recepção', desc: 'Confirmar a recepção dos itens entregues.', status: 'AGUARDANDO', priority: 'MEDIA' });
    else if (po.status === 'EM_EXECUCAO' && po.dispatchedAt) tasks.push({ ...base, type: 'ENTREGA', title: 'Acompanhar Entrega', desc: 'Verificar o estado da entrega em andamento.', status: 'EM_ANDAMENTO', priority: 'MEDIA' });
    else if (po.status === 'RECEBIDA_COM_DIVERGENCIA') tasks.push({ ...base, type: 'DIVERGENCIA', title: 'Resolver Divergência', desc: 'Analisar divergência na recepção de itens.', status: 'ATRASADA', priority: 'ALTA' });
    else if (RECEIVED.includes(po.status)) tasks.push({ ...base, type: 'CONCLUIDA', title: 'Ordem concluída', desc: 'Recepção confirmada com sucesso.', status: 'CONCLUIDA', priority: 'BAIXA' });
  }
  let list = tasks;
  if (filter === 'PENDENTES') list = tasks.filter((t) => t.status === 'PENDENTE');
  else if (filter === 'ANDAMENTO') list = tasks.filter((t) => t.status === 'EM_ANDAMENTO');
  else if (filter === 'CONCLUIDAS') list = tasks.filter((t) => t.status === 'CONCLUIDA');
  else if (filter === 'ATRASADAS') list = tasks.filter((t) => t.status === 'ATRASADA');

  const kpis = {
    minhasTarefas: tasks.filter((t) => t.status === 'PENDENTE').length,
    aguardando: tasks.filter((t) => t.status === 'AGUARDANDO').length,
    concluidas: tasks.filter((t) => t.status === 'CONCLUIDA').length,
    atrasadas: tasks.filter((t) => t.status === 'ATRASADA').length,
    emAndamento: tasks.filter((t) => t.status === 'EM_ANDAMENTO').length,
  };
  return { kpis, items: list };
}

// ---------------------------------------------------------------------------
// Perfil (item 12)
// ---------------------------------------------------------------------------
async function profile({ userId, companyId }) {
  const [user, company, orders] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, role: true, createdAt: true } }),
    companyId ? prisma.company.findUnique({ where: { id: companyId } }) : null,
    companyId ? prisma.purchaseOrder.findMany({ where: { buyerCompanyId: companyId }, include: PO_INCLUDE, orderBy: { updatedAt: 'desc' } }) : [],
  ]);
  const now = new Date(); const yearStart = new Date(now.getFullYear(), 0, 1);
  const yearOrders = orders.filter((o) => new Date(o.createdAt) >= yearStart);
  const suppliersSet = new Set(orders.map((o) => o.supplierCompanyId));
  const itemsReceived = orders.filter((o) => RECEIVED.includes(o.status)).reduce((s, o) => s + itemsCount(o), 0);

  const recent = orders.slice(0, 5).map((o) => ({
    reference: o.reference, supplier: o.supplierCompany?.name, status: o.status, at: o.updatedAt,
  }));
  return {
    user, company,
    summary: {
      ordersYear: yearOrders.length,
      totalBought: yearOrders.reduce((s, o) => s + num(o.totalAmount), 0),
      suppliers: suppliersSet.size,
      itemsReceived,
    },
    recent,
  };
}

module.exports = { orders, payments, deliveries, receptions, suppliers, activities, profile };
