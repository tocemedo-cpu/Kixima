// src/services/taxService.js
// IVA e comissão da plataforma.
//  - IVA (lei angolana): 14% sobre tudo (produtos e serviços).
//  - Comissão KIXIMA: 6,5% — a parte que fica com a plataforma (não é imposto).
// Ambas configuráveis por ambiente.
const IVA_RATE = Number(process.env.IVA_RATE) || 0.14;                 // imposto (14%)
const COMMISSION_RATE = Number(process.env.KIXIMA_COMMISSION) || 0.065; // comissão da plataforma (6,5%)

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// O IVA é igual para produto e serviço; `kind` é aceite por compatibilidade.
function rateForKind() {
  return IVA_RATE;
}

// Calcula o IVA de um montante líquido.
function computeTax(netAmount) {
  const tax = round2(Number(netAmount) * IVA_RATE);
  return { rate: IVA_RATE, net: round2(netAmount), tax, gross: round2(Number(netAmount) + tax) };
}

// Comissão da plataforma sobre um montante líquido (o que fica com a KIXIMA).
function commission(netAmount) {
  return round2(Number(netAmount) * COMMISSION_RATE);
}

// Agrega várias linhas ({ net }) num resumo com IVA (14%).
function summarize(lines) {
  const net = round2(lines.reduce((s, l) => s + Number(l.net || 0), 0));
  const tax = round2(net * IVA_RATE);
  return { net, tax, gross: round2(net + tax), rate: IVA_RATE };
}

module.exports = { IVA_RATE, COMMISSION_RATE, rateForKind, computeTax, commission, summarize };
