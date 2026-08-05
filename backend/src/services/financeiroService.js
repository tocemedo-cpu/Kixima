// src/services/financeiroService.js
// Agregações de leitura das telas do Financeiro (Centro Financeiro, Faturas
// Pendentes, Pagamentos). O Financeiro executa o pagamento das faturas geradas
// para as POs da sua empresa, dentro do SLA — segue o fluxo do KIXIMA.
const prisma = require('../config/database');

const num = (d) => Number(d ?? 0);
const SUPPLIER = { select: { name: true } };
const PO_INC = { include: { supplierCompany: SUPPLIER } };

// Faturas da empresa compradora (via PO ou contrato).
const invoiceWhere = (companyId, extra = {}) => ({
  ...extra,
  OR: [{ purchaseOrder: { buyerCompanyId: companyId } }, { contract: { clientCompanyId: companyId } }],
});

async function loadInvoices(companyId) {
  return prisma.invoice.findMany({
    where: invoiceWhere(companyId),
    include: { purchaseOrder: PO_INC, contract: { select: { reference: true, supplierCompany: SUPPLIER } }, payment: true },
    orderBy: { dueAt: 'asc' },
  });
}

function supplierOf(inv) {
  return inv.purchaseOrder?.supplierCompany?.name || inv.contract?.supplierCompany?.name || '—';
}
function shapeInvoice(inv) {
  return {
    id: inv.id, reference: inv.reference, supplier: supplierOf(inv),
    poReference: inv.purchaseOrder?.reference || inv.contract?.reference || null,
    poId: inv.purchaseOrderId || inv.purchaseOrder?.id || null,
    amount: num(inv.amount), currency: inv.currency, status: inv.status,
    issuedAt: inv.issuedAt, dueAt: inv.dueAt,
    paidAt: inv.payment?.processedAt || null,
  };
}

// Centro Financeiro (dashboard).
async function overview(companyId) {
  const invoices = await loadInvoices(companyId);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const in7 = now.getTime() + 7 * 864e5;

  const pendentes = invoices.filter((i) => i.status === 'PENDENTE');
  const pagasMes = invoices.filter((i) => i.status === 'PAGA' && i.payment && new Date(i.payment.processedAt) >= monthStart);

  // Série mensal (6 meses): faturas recebidas vs pagamentos.
  const months = [];
  for (let k = 5; k >= 0; k--) months.push(new Date(now.getFullYear(), now.getMonth() - k, 1));
  const series = months.map((m) => {
    const next = new Date(m.getFullYear(), m.getMonth() + 1, 1);
    const faturas = invoices.filter((i) => new Date(i.issuedAt) >= m && new Date(i.issuedAt) < next).reduce((s, i) => s + num(i.amount), 0);
    const pagamentos = invoices.filter((i) => i.payment && new Date(i.payment.processedAt) >= m && new Date(i.payment.processedAt) < next).reduce((s, i) => s + num(i.amount), 0);
    return { label: m.toLocaleDateString('pt-PT', { month: 'short' }), faturas, pagamentos };
  });

  return {
    kpis: {
      pagamentosPendentes: pendentes.reduce((s, i) => s + num(i.amount), 0),
      pagamentosPendentesCount: pendentes.length,
      faturasRecebidas: invoices.length,
      pagosMes: pagasMes.reduce((s, i) => s + num(i.amount), 0),
      aprovacoesPendentes: pendentes.length,
      aVencer7: pendentes.filter((i) => new Date(i.dueAt).getTime() <= in7).length,
    },
    series,
    pendentes: pendentes.slice(0, 5).map(shapeInvoice),
  };
}

// Faturas Pendentes.
async function invoices(companyId) {
  const all = await loadInvoices(companyId);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const in7 = now.getTime() + 7 * 864e5;
  const pend = all.filter((i) => i.status === 'PENDENTE');
  const kpis = {
    pendentes: pend.length,
    valorPendente: pend.reduce((s, i) => s + num(i.amount), 0),
    aVencer7: pend.filter((i) => new Date(i.dueAt).getTime() <= in7).length,
    vencidas: pend.filter((i) => new Date(i.dueAt) < now).length,
    aprovadasMes: all.filter((i) => i.status === 'PAGA' && i.payment && new Date(i.payment.processedAt) >= monthStart).length,
  };
  return { kpis, items: pend.map(shapeInvoice) };
}

// Pagamentos (histórico + pendentes).
async function payments(companyId, status) {
  const all = await loadInvoices(companyId);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  let rows = all.map(shapeInvoice);
  if (status === 'PENDENTE') rows = rows.filter((r) => r.status === 'PENDENTE');
  else if (status === 'PAGO') rows = rows.filter((r) => r.status === 'PAGA');
  else if (status === 'VENCIDO') rows = rows.filter((r) => r.status === 'VENCIDA' || (r.status === 'PENDENTE' && new Date(r.dueAt) < now));

  const kpis = {
    aPagar: all.filter((i) => i.status === 'PENDENTE').reduce((s, i) => s + num(i.amount), 0),
    pagosMes: all.filter((i) => i.status === 'PAGA' && i.payment && new Date(i.payment.processedAt) >= monthStart).reduce((s, i) => s + num(i.amount), 0),
    vencidos: all.filter((i) => i.status === 'PENDENTE' && new Date(i.dueAt) < now).reduce((s, i) => s + num(i.amount), 0),
    total: all.length,
  };
  return { kpis, items: rows };
}

module.exports = { overview, invoices, payments };
