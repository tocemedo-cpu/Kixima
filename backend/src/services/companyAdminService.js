// src/services/companyAdminService.js
// Agregações de leitura das telas do Company Admin (Dashboard, Organização,
// Atividades, Relatórios). Tudo derivado dos dados reais da empresa
// (PurchaseOrder / Contract / User / Invoice), seguindo o fluxo do KIXIMA.
const prisma = require('../config/database');

const num = (d) => Number(d ?? 0);
const ACTIVE = ['APROVADA', 'ACEITE_FORNECEDOR', 'AGUARDANDO_PAGAMENTO', 'PAGA', 'EM_EXECUCAO', 'ENTREGUE'];
const RECEIVED = ['RECEBIDA_CONFORME', 'RECEBIDA_COM_DIVERGENCIA', 'CONCLUIDA'];

// POs que envolvem a empresa (como compradora ou fornecedora).
const companyWhere = (companyId) => ({ OR: [{ buyerCompanyId: companyId }, { supplierCompanyId: companyId }] });

async function dashboard(companyId) {
  const [orders, contracts, users, company] = await Promise.all([
    prisma.purchaseOrder.findMany({ where: companyWhere(companyId), include: { supplierCompany: { select: { name: true } }, buyerCompany: { select: { name: true } } } }),
    prisma.contract.findMany({ where: { OR: [{ clientCompanyId: companyId }, { supplierCompanyId: companyId }] } }),
    prisma.user.findMany({ where: { companyId }, select: { id: true, active: true } }),
    prisma.company.findUnique({ where: { id: companyId }, select: { verified: true } }),
  ]);

  // Volume de Operações — últimos 6 meses (soma de totais de PO por mês).
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) months.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
  const volume = months.map((m) => {
    const next = new Date(m.getFullYear(), m.getMonth() + 1, 1);
    const total = orders.filter((o) => new Date(o.createdAt) >= m && new Date(o.createdAt) < next).reduce((s, o) => s + num(o.totalAmount), 0);
    return { label: m.toLocaleDateString('pt-PT', { month: 'short' }), value: total };
  });

  const recent = orders.slice().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 5).map((o) => ({
    reference: o.reference, status: o.status, at: o.updatedAt,
    party: o.buyerCompanyId === companyId ? o.supplierCompany?.name : o.buyerCompany?.name,
  }));

  return {
    kpis: {
      pedidos: orders.length,
      emExecucao: orders.filter((o) => o.status === 'EM_EXECUCAO' || o.status === 'ENTREGUE').length,
      volumeNegocios: orders.reduce((s, o) => s + num(o.totalAmount), 0),
      aprovarPO: orders.filter((o) => o.status === 'AGUARDANDO_APROVACAO' && o.buyerCompanyId === companyId).length,
    },
    resumo: {
      usuariosAtivos: users.filter((u) => u.active).length,
      contratosAtivos: contracts.filter((c) => c.status === 'ATIVO').length,
      totalContratos: contracts.length,
      concluidas: orders.filter((o) => RECEIVED.includes(o.status)).length,
      compliance: company?.verified ? 100 : 80,
    },
    volume, recent,
  };
}

async function organizacao(companyId) {
  const [company, users, contracts, docs, policies] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId } }),
    prisma.user.count({ where: { companyId } }),
    prisma.contract.count({ where: { OR: [{ clientCompanyId: companyId }, { supplierCompanyId: companyId }] } }),
    prisma.companyDocument.count({ where: { companyId } }),
    prisma.supplierToKiximaPolicy.count({ where: { companyId } }),
  ]);
  return { company, summary: { users, contracts, documents: docs, certifications: policies } };
}

async function activities(companyId, filter) {
  const orders = await prisma.purchaseOrder.findMany({
    where: companyWhere(companyId),
    include: { supplierCompany: { select: { name: true } }, buyerCompany: { select: { name: true } }, createdBy: { select: { name: true } } },
    orderBy: { updatedAt: 'desc' }, take: 60,
  });
  const STATUS = {
    AGUARDANDO_APROVACAO: { type: 'Aprovação', status: 'PENDENTE', module: 'Ordens de Compra' },
    APROVADA: { type: 'Aprovação', status: 'CONCLUIDA', module: 'Ordens de Compra' },
    AGUARDANDO_PAGAMENTO: { type: 'Financeiro', status: 'PENDENTE', module: 'Financeiro' },
    PAGA: { type: 'Financeiro', status: 'CONCLUIDA', module: 'Financeiro' },
    EM_EXECUCAO: { type: 'Acompanhamento', status: 'ANDAMENTO', module: 'Entregas' },
    ENTREGUE: { type: 'Acompanhamento', status: 'ANDAMENTO', module: 'Entregas' },
    RECEBIDA_CONFORME: { type: 'Conclusão', status: 'CONCLUIDA', module: 'Recepção' },
    RECEBIDA_COM_DIVERGENCIA: { type: 'Divergência', status: 'ATRASADA', module: 'Recepção' },
    CONCLUIDA: { type: 'Conclusão', status: 'CONCLUIDA', module: 'Ordens de Compra' },
    REJEITADA: { type: 'Rejeição', status: 'ATRASADA', module: 'Ordens de Compra' },
    RECUSADA_FORNECEDOR: { type: 'Rejeição', status: 'ATRASADA', module: 'Ordens de Compra' },
  };
  let items = orders.map((o) => {
    const m = STATUS[o.status] || { type: 'Atualização', status: 'CONCLUIDA', module: 'Ordens de Compra' };
    return {
      title: `PO ${o.reference}`, desc: `${m.type} — ${o.status.replaceAll('_', ' ').toLowerCase()}`,
      module: m.module, type: m.type, status: m.status, relatedTo: o.reference,
      party: o.buyerCompanyId === companyId ? o.supplierCompany?.name : o.buyerCompany?.name,
      responsavel: o.createdBy?.name, at: o.updatedAt,
    };
  });
  if (filter && filter !== 'TODOS') items = items.filter((i) => i.status === filter);

  const src = orders.map((o) => (STATUS[o.status]?.status || 'CONCLUIDA'));
  const kpis = {
    total: orders.length,
    concluidas: src.filter((s) => s === 'CONCLUIDA').length,
    pendentes: src.filter((s) => s === 'PENDENTE').length,
    andamento: src.filter((s) => s === 'ANDAMENTO').length,
    atrasadas: src.filter((s) => s === 'ATRASADA').length,
  };
  return { kpis, items };
}

async function reports(companyId) {
  const orders = await prisma.purchaseOrder.findMany({
    where: companyWhere(companyId), include: { invoice: true }, orderBy: { createdAt: 'desc' },
  });
  const contracts = await prisma.contract.findMany({ where: { OR: [{ clientCompanyId: companyId }, { supplierCompanyId: companyId }] } });

  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) months.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
  const series = months.map((m) => {
    const next = new Date(m.getFullYear(), m.getMonth() + 1, 1);
    const inRange = (d) => new Date(d) >= m && new Date(d) < next;
    const os = orders.filter((o) => inRange(o.createdAt));
    return {
      label: m.toLocaleDateString('pt-PT', { month: 'short' }),
      receitas: os.filter((o) => o.invoice?.status === 'PAGA').reduce((s, o) => s + num(o.invoice.amount), 0),
      despesas: os.reduce((s, o) => s + num(o.totalAmount), 0),
      contratos: contracts.filter((c) => inRange(c.createdAt)).length,
    };
  });

  // "Relatórios disponíveis" — tipos gerados a partir de dados reais.
  const catalog = [
    { key: 'financeiro', name: 'Relatório Financeiro', module: 'Financeiro', desc: 'Resumo de faturas e pagamentos', format: 'PDF' },
    { key: 'ordens', name: 'Relatório de Ordens de Compra', module: 'Ordens', desc: 'POs por estado e valor', format: 'Excel' },
    { key: 'contratos', name: 'Relatório de Contratos', module: 'Contratos', desc: 'Estado e validade dos contratos', format: 'PDF' },
    { key: 'atividades', name: 'Atividade da Empresa', module: 'Atividades', desc: 'Ações e acessos recentes', format: 'PDF' },
  ];
  const kpis = {
    gerados: catalog.length,
    ordens: orders.length,
    contratos: contracts.length,
    faturado: orders.filter((o) => o.invoice?.status === 'PAGA').reduce((s, o) => s + num(o.invoice.amount), 0),
  };
  return { kpis, series, catalog };
}

async function getSettings(companyId) {
  const c = await prisma.company.findUnique({ where: { id: companyId }, select: { settings: true } });
  return c?.settings || DEFAULT_SETTINGS;
}
async function saveSettings(companyId, settings) {
  const merged = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  await prisma.company.update({ where: { id: companyId }, data: { settings: merged } });
  return merged;
}
const DEFAULT_SETTINGS = {
  aprovacaoObrigatoria: true,
  assinaturaDigital: false,
  historicoAlteracoes: true,
  backupAutomatico: true,
  lembretesPrazos: true,
  valoresSemImpostos: false,
};

module.exports = { dashboard, organizacao, activities, reports, getSettings, saveSettings };
