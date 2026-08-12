// src/services/platformFeeService.js
// Taxa da plataforma (comissão KIXIMA), à parte da PO/Fatura, cobrada ao
// fornecedor. Modelo comercial (agosto/2026):
//
//   • por ORDEM DE COMPRA: 8 USD fixos até ao limiar de 11.500 USD de valor da
//     transação; ACIMA do limiar passa a 0,20% do valor da transação (a
//     percentagem SUBSTITUI o valor fixo).
//   • por FATURA: 15 USD fixos, sempre.
//
//   taxa = (nº de POs × parcela por PO) + 15 USD
//
// MOEDA: as taxas são definidas, calculadas e cobradas em USD. As POs e faturas
// continuam em Kwanzas — para comparar o valor da transação com o limiar em
// dólares usa-se um câmbio configurável (KIXIMA_USD_AOA_RATE). O câmbio usado e
// o valor em USD ficam guardados em cada taxa, para o extrato ser auditável e
// para o histórico não mudar quando o câmbio mudar.
const config = require('../config/env');

const PER_PO = Number(process.env.KIXIMA_FEE_PER_PO_USD) || 8;            // USD por PO (≤ limiar)
const PER_INVOICE = Number(process.env.KIXIMA_FEE_PER_INVOICE_USD) || 15; // USD por fatura
const THRESHOLD_USD = Number(process.env.KIXIMA_FEE_THRESHOLD_USD) || 11500;
const PERCENT_ABOVE = Number(process.env.KIXIMA_FEE_PERCENT_ABOVE) || 0.002; // 0,20%
const CURRENCY = 'USD';

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Câmbio USD→AOA usado para aferir o limiar (o Kwanza flutua; é configurável).
function fxRate() {
  return Number(process.env.KIXIMA_USD_AOA_RATE) || config.business.usdAoaRate || 900;
}

// Converte um valor da moeda da transação para USD.
function toUsd(amount, currency = 'AOA', rate = fxRate()) {
  const v = Number(amount) || 0;
  if (String(currency).toUpperCase() === 'USD') return round2(v);
  return round2(v / rate);
}

// Parcela por ORDEM DE COMPRA, dado o valor da transação já em USD.
function poFee(poValueUsd) {
  if (Number(poValueUsd) > THRESHOLD_USD) {
    return { perPo: round2(Number(poValueUsd) * PERCENT_ABOVE), basis: 'PERCENTUAL' };
  }
  return { perPo: PER_PO, basis: 'FIXO' };
}

/**
 * Calcula a taxa de uma fatura.
 * @param poCount    nº de POs cobertas (1 na fatura normal; N no call-off consolidado)
 * @param poValueUsd valor da transação (por PO) em USD — decide o limiar
 */
function compute(poCount, poValueUsd = 0) {
  const count = Math.max(1, Number(poCount) || 1);
  const { perPo, basis } = poFee(poValueUsd);
  return {
    poCount: count,
    perPo,
    perInvoice: PER_INVOICE,
    amount: round2(count * perPo + PER_INVOICE),
    currency: CURRENCY,
    basis,
    poValueUsd: round2(poValueUsd),
  };
}

// Cria o registo de taxa para uma fatura, dentro de uma transação (tx). O nº de
// POs é 1 (fatura normal) ou o nº de call-offs consolidados.
async function createForInvoice(tx, { invoice, companyId }) {
  const poCount = invoice.consolidatedPoIds?.length || 1;
  const rate = fxRate();
  // O limiar aplica-se POR TRANSAÇÃO: numa fatura consolidada, o total do
  // período é dividido pelo nº de POs para aferir cada uma.
  const totalUsd = toUsd(invoice.amount, invoice.currency, rate);
  const perPoValueUsd = round2(totalUsd / poCount);
  const f = compute(poCount, perPoValueUsd);
  return tx.platformFee.create({
    data: {
      companyId,
      invoiceId: invoice.id,
      poCount: f.poCount,
      perPo: f.perPo,
      perInvoice: f.perInvoice,
      amount: f.amount,
      currency: f.currency,
      basis: f.basis,
      poValueUsd: f.poValueUsd,
      fxRate: rate,
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
    select: {
      id: true, name: true, taxId: true, address: true, city: true, province: true,
      country: true, contactEmail: true, plan: true, size: true, seatPriceUsd: true,
    },
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
      // Nomes mantidos por compatibilidade da UI; os valores estão em USD.
      totalAOA: sum(fees),
      pendingAOA: sum(pendentes),
      chargedAOA: sum(cobradas),
      pendentes: pendentes.length,
      cobradas: cobradas.length,
      currency: CURRENCY,
    },
    formula: {
      perPo: PER_PO,
      perInvoice: PER_INVOICE,
      thresholdUsd: THRESHOLD_USD,
      percentAbove: PERCENT_ABOVE,
      currency: CURRENCY,
    },
    generatedAt: new Date(),
  };
}

module.exports = {
  PER_PO, PER_INVOICE, THRESHOLD_USD, PERCENT_ABOVE, CURRENCY,
  fxRate, toUsd, compute, createForInvoice, statementFor,
};
