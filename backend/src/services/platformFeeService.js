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

module.exports = { PER_PO, PER_INVOICE, CURRENCY, compute, createForInvoice };
