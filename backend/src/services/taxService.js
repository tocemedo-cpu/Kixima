// src/services/taxService.js
// Impostos aplicáveis (lei angolana):
//  - IVA: 14% sobre tudo (produtos e serviços). Soma-se à fatura (o comprador
//    paga o total com IVA).
//  - Retenção na Fonte de Imposto Industrial (Lei 26/20): 6,5% sobre SERVIÇOS.
//    NÃO soma à fatura — o comprador desconta 6,5% do valor do serviço e
//    entrega à AGT por conta do fornecedor. Reduz o líquido do fornecedor.
// Ambas as taxas são configuráveis por ambiente.
const IVA_RATE = Number(process.env.IVA_RATE) || 0.14;
const WITHHOLDING_RATE = Number(process.env.WITHHOLDING_RATE) || 0.065; // retenção II (serviços)

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// O IVA é igual para produto e serviço; `kind` é aceite por compatibilidade.
function rateForKind() {
  return IVA_RATE;
}

// IVA de um montante líquido.
function computeTax(netAmount) {
  const tax = round2(Number(netAmount) * IVA_RATE);
  return { rate: IVA_RATE, net: round2(netAmount), tax, gross: round2(Number(netAmount) + tax) };
}

// Retenção na fonte (II) de uma linha — só se aplica a serviços.
function withholdingFor(netAmount, kind) {
  return kind === 'SERVICO' ? round2(Number(netAmount) * WITHHOLDING_RATE) : 0;
}

// Agrega várias linhas ({ net, kind }) com IVA (14% em tudo) e retenção na
// fonte (6,5% só nas linhas de serviço).
//  - gross    = net + IVA          (total a pagar pelo comprador)
//  - withheld = retenção sobre serviços (descontada ao fornecedor)
//  - supplierNet = gross - withheld (líquido que o fornecedor recebe)
function summarize(lines) {
  const net = round2(lines.reduce((s, l) => s + Number(l.net || 0), 0));
  const tax = round2(net * IVA_RATE);
  const withheld = round2(lines.reduce((s, l) => s + withholdingFor(l.net, l.kind), 0));
  const gross = round2(net + tax);
  return { net, tax, gross, withheld, supplierNet: round2(gross - withheld), rate: IVA_RATE, withholdingRate: WITHHOLDING_RATE };
}

module.exports = { IVA_RATE, WITHHOLDING_RATE, rateForKind, computeTax, withholdingFor, summarize };
