// src/services/platformFeeService.js
// Taxa da plataforma (comissão KIXIMA), à parte da PO/Fatura. Composição:
//   taxa = (nº de POs da fatura × PER_PO) + PER_INVOICE
// Valores em AOA, configuráveis por ambiente. Gerada na transação do pagamento.
const PER_PO = Number(process.env.KIXIMA_FEE_PER_PO) || 2000;        // por Ordem de Compra
const PER_INVOICE = Number(process.env.KIXIMA_FEE_PER_INVOICE) || 5000; // fixo por fatura
const CURRENCY = 'AOA';

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function compute(poCount) {
  const count = Math.max(1, Number(poCount) || 1);
  return {
    poCount: count,
    perPo: PER_PO,
    perInvoice: PER_INVOICE,
    amount: round2(count * PER_PO + PER_INVOICE),
    currency: CURRENCY,
  };
}

// Cria o registo de taxa para uma fatura, dentro de uma transação (tx). O nº de
// POs é 1 (fatura normal) ou o nº de call-offs consolidados.
async function createForInvoice(tx, { invoice, companyId }) {
  const poCount = invoice.consolidatedPoIds?.length || 1;
  const f = compute(poCount);
  return tx.platformFee.create({
    data: {
      companyId,
      invoiceId: invoice.id,
      poCount: f.poCount,
      perPo: f.perPo,
      perInvoice: f.perInvoice,
      amount: f.amount,
      currency: f.currency,
    },
  });
}

// Extrato de taxas de UMA empresa (fornecedor): lista completa + totais.
// Serve a página do fornecedor ("quanto devo à KIXIMA e porquê") e o documento
// de cobrança imprimível do Admin.
async function statementFor(companyId) {
  const prisma = require('../config/database');
  const { NotFoundError } = require('../utils/errors');

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, taxId: true, address: true, city: true, province: true, country: true, contactEmail: true },
  });
  if (!company) throw new NotFoundError('Empresa');

  const fees = await prisma.platformFee.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    include: { invoice: { select: { reference: true, amount: true, currency: true } } },
  });

  const sum = (list) => round2(list.reduce((s, f) => s + Number(f.amount), 0));
  const pendentes = fees.filter((f) => f.status === 'PENDENTE');
  const cobradas = fees.filter((f) => f.status === 'COBRADO');

  return {
    company,
    fees,
    kpis: {
      total: fees.length,
      totalAOA: sum(fees),
      pendingAOA: sum(pendentes),
      chargedAOA: sum(cobradas),
      pendentes: pendentes.length,
      cobradas: cobradas.length,
    },
    formula: { perPo: PER_PO, perInvoice: PER_INVOICE, currency: CURRENCY },
    generatedAt: new Date(),
  };
}

module.exports = { PER_PO, PER_INVOICE, CURRENCY, compute, createForInvoice, statementFor };
