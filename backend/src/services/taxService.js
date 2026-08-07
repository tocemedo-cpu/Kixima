// src/services/taxService.js
// Cálculo de IVA segundo a lei angolana. Taxa geral de 14% para bens/produtos;
// 6,5% para serviços. As taxas são configuráveis por ambiente.
const STANDARD = Number(process.env.IVA_RATE_STANDARD) || 0.14;   // produtos/bens
const SERVICES = Number(process.env.IVA_RATE_SERVICES) || 0.065;  // serviços

// kind: 'PRODUTO' | 'SERVICO' (ProductKind). Serviço → 6,5%; restante → 14%.
function rateForKind(kind) {
  return kind === 'SERVICO' ? SERVICES : STANDARD;
}

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Calcula o IVA de um montante líquido para um dado tipo.
function computeTax(netAmount, kind) {
  const rate = rateForKind(kind);
  const tax = round2(Number(netAmount) * rate);
  return { rate, net: round2(netAmount), tax, gross: round2(Number(netAmount) + tax) };
}

// Agrega várias linhas ({ net, kind }) num resumo com IVA por taxa.
function summarize(lines) {
  let net = 0; let tax = 0;
  const byRate = {};
  for (const l of lines) {
    const r = computeTax(l.net, l.kind);
    net += r.net; tax += r.tax;
    const key = r.rate.toString();
    byRate[key] = round2((byRate[key] || 0) + r.tax);
  }
  net = round2(net); tax = round2(tax);
  return { net, tax, gross: round2(net + tax), byRate };
}

module.exports = { STANDARD, SERVICES, rateForKind, computeTax, summarize };
