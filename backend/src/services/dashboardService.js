// src/services/dashboardService.js
// Resumo do painel do Comprador a partir de dados reais (ordens de compra).

const prisma = require('../config/database');

const ACTIVE = ['AGUARDANDO_APROVACAO', 'APROVADA', 'ACEITE_FORNECEDOR', 'AGUARDANDO_PAGAMENTO', 'PAGA', 'EM_EXECUCAO', 'ENTREGUE'];
const RECEIVED = ['RECEBIDA_CONFORME', 'RECEBIDA_COM_DIVERGENCIA', 'CONCLUIDA'];
const CANCELLED = ['REJEITADA', 'RECUSADA_FORNECEDOR'];

async function buyerSummary(buyerCompanyId) {
  const pos = await prisma.purchaseOrder.findMany({
    where: { buyerCompanyId },
    select: { status: true, totalAmount: true, createdAt: true },
  });

  const byStatus = {};
  let emAndamento = 0;
  let aguardCount = 0, aguardTotal = 0;
  let entregaCount = 0, entregaTotal = 0;
  let recebidasMes = 0;

  const now = new Date();
  const mStart = new Date(now.getFullYear(), now.getMonth(), 1);

  for (const p of pos) {
    byStatus[p.status] = (byStatus[p.status] || 0) + 1;
    const amt = Number(p.totalAmount);
    if (ACTIVE.includes(p.status)) emAndamento += 1;
    if (p.status === 'AGUARDANDO_PAGAMENTO') { aguardCount += 1; aguardTotal += amt; }
    if (p.status === 'EM_EXECUCAO' || p.status === 'ENTREGUE') { entregaCount += 1; entregaTotal += amt; }
    if (RECEIVED.includes(p.status) && new Date(p.createdAt) >= mStart) recebidasMes += 1;
  }

  const sum = (arr) => arr.reduce((s, st) => s + (byStatus[st] || 0), 0);
  const minhasOrdens = [
    { label: 'Aguardando Pagamento', count: byStatus.AGUARDANDO_PAGAMENTO || 0 },
    { label: 'Em Execução', count: byStatus.EM_EXECUCAO || 0 },
    { label: 'Em Entrega', count: byStatus.ENTREGUE || 0 },
    { label: 'Recebidas', count: sum(RECEIVED) },
    { label: 'Canceladas', count: sum(CANCELLED) },
  ];

  return {
    kpis: {
      emAndamento,
      aguardandoPagamento: { count: aguardCount, total: aguardTotal },
      emEntrega: { count: entregaCount, total: entregaTotal },
      recebidasMes,
    },
    minhasOrdens,
  };
}

module.exports = { buyerSummary };
