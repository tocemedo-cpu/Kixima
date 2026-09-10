// src/services/categoryAnalyticsService.js
// Analítica de compras por categoria/produto — a base de dados/cálculo do
// Category Management (Economia de Escala) e do PO Robot (funcionalidade do
// add-on de automação, que reutiliza mediaMensalPorProduto em vez de
// duplicar o cálculo).
//
// Lê exclusivamente o que já existe (PurchaseOrderItem → Product →
// PurchaseOrder) — nenhuma tabela nova para isto. Considera só POs que
// representam compra reconhecida (mesmo universo do metricasService: PAGA em
// diante), para não contar ordens ainda por aprovar/pagar como volume.
const prisma = require('../config/database');

const RECONHECIDAS = ['PAGA', 'EM_EXECUCAO', 'ENTREGUE', 'RECEBIDA_CONFORME', 'RECEBIDA_COM_DIVERGENCIA', 'CONCLUIDA'];

function janela(dias = 365, agora = new Date()) {
  const de = new Date(agora);
  de.setDate(de.getDate() - dias);
  return { de, ate: agora };
}

const num = (d) => Number(d || 0);

/** Volume de compra reconhecida por categoria de produto, num período. */
async function volumePorCategoria({ companyId, de, ate } = {}) {
  const periodo = de && ate ? { de, ate } : janela(365);
  const itens = await prisma.purchaseOrderItem.findMany({
    where: {
      purchaseOrder: {
        buyerCompanyId: companyId,
        status: { in: RECONHECIDAS },
        createdAt: { gte: periodo.de, lte: periodo.ate },
      },
    },
    select: { lineTotal: true, product: { select: { category: true } } },
  });

  const porCategoria = new Map();
  let total = 0;
  for (const it of itens) {
    const categoria = it.product?.category || 'Sem categoria';
    const valor = num(it.lineTotal);
    porCategoria.set(categoria, (porCategoria.get(categoria) || 0) + valor);
    total += valor;
  }

  return {
    periodo: { de: periodo.de.toISOString(), ate: periodo.ate.toISOString() },
    total,
    categorias: [...porCategoria.entries()]
      .map(([categoria, valor]) => ({
        categoria,
        valor,
        percentual: total ? Math.round((valor / total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.valor - a.valor),
  };
}

/** Quantidade comprada de um produto, agrupada por mês (YYYY-MM), ordenada. */
async function historicoMensalPorProduto({ companyId, productId, meses = 12 } = {}) {
  const { de, ate } = janela(meses * 30);
  const itens = await prisma.purchaseOrderItem.findMany({
    where: {
      productId,
      purchaseOrder: { buyerCompanyId: companyId, status: { in: RECONHECIDAS }, createdAt: { gte: de, lte: ate } },
    },
    select: { quantity: true, purchaseOrder: { select: { createdAt: true } } },
  });

  const porMes = new Map();
  for (const it of itens) {
    const d = it.purchaseOrder.createdAt;
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    porMes.set(chave, (porMes.get(chave) || 0) + it.quantity);
  }

  return [...porMes.entries()]
    .map(([mes, quantidade]) => ({ mes, quantidade }))
    .sort((a, b) => (a.mes < b.mes ? -1 : 1));
}

/**
 * Média mensal de compra de um produto, com base no histórico. Usada pelo
 * Category Management (recomendação) e pelo PO Robot (regra com
 * `mediaOrigem: 'IA'`) — a MESMA função, nunca duplicada entre as duas
 * funcionalidades.
 *
 * Divide-se pelos MESES DECORRIDOS desde a primeira compra do produto, não
 * só pelos meses em que houve compra: um produto comprado a cada 3 meses tem
 * uma média mensal de 1/3 da quantidade por compra, não a quantidade inteira
 * — senão o robot pediria a mesma quantidade todos os meses de um produto
 * que só se compra trimestralmente.
 */
async function mediaMensalPorProduto({ companyId, productId, meses = 12 } = {}) {
  const historico = await historicoMensalPorProduto({ companyId, productId, meses });
  if (!historico.length) {
    return { produtoId: productId, amostras: 0, mesesComCompra: 0, mediaMensal: 0 };
  }

  const quantidadeTotal = historico.reduce((s, m) => s + m.quantidade, 0);
  const [primeiroMes] = historico;
  const [ano0, mes0] = primeiroMes.mes.split('-').map(Number);
  const agora = new Date();
  const mesesDecorridos = Math.max(1, (agora.getFullYear() - ano0) * 12 + (agora.getMonth() + 1 - mes0) + 1);

  return {
    produtoId: productId,
    amostras: historico.length,
    mesesComCompra: historico.length,
    mesesDecorridos,
    quantidadeTotal,
    mediaMensal: Math.round((quantidadeTotal / mesesDecorridos) * 100) / 100,
  };
}

/**
 * Previsão simples (média móvel) da quantidade necessária no próximo mês,
 * a partir dos últimos `janelaMeses` com compra. Deliberadamente sem ML
 * pesado — é uma média, não um modelo, e diz-se isso ao cliente.
 */
async function previsaoNecessidade({ companyId, productId, janelaMeses = 3 } = {}) {
  const historico = await historicoMensalPorProduto({ companyId, productId, meses: 12 });
  if (!historico.length) return { produtoId: productId, previsaoProximoMes: 0, baseMeses: 0 };

  const ultimos = historico.slice(-janelaMeses);
  const media = ultimos.reduce((s, m) => s + m.quantidade, 0) / ultimos.length;
  return {
    produtoId: productId,
    previsaoProximoMes: Math.round(media * 100) / 100,
    baseMeses: ultimos.length,
  };
}

/**
 * Categorias com compra fragmentada (várias POs pequenas) que, consolidadas
 * num período, cruzariam o próximo threshold de desconto configurado.
 *
 * `thresholds` vem de quem chama (discountThresholdService.listar()) — esta
 * função não conhece os valores dos patamares, só compara contra o que lhe é
 * passado, para a configuração continuar a viver num único lugar.
 */
async function oportunidadesConsolidacao({ companyId, de, ate, thresholds } = {}) {
  const patamares = (thresholds || [])
    .filter((t) => t.ativo !== false)
    .map((t) => ({ minVolumeUsd: num(t.minVolumeUsd), discountPercent: num(t.discountPercent) }))
    .sort((a, b) => a.minVolumeUsd - b.minVolumeUsd);
  if (!patamares.length) return [];

  const periodo = de && ate ? { de, ate } : janela(365);
  const itens = await prisma.purchaseOrderItem.findMany({
    where: {
      purchaseOrder: {
        buyerCompanyId: companyId,
        status: { in: RECONHECIDAS },
        createdAt: { gte: periodo.de, lte: periodo.ate },
      },
    },
    select: { lineTotal: true, purchaseOrderId: true, product: { select: { category: true } } },
  });

  const porCategoria = new Map();
  for (const it of itens) {
    const categoria = it.product?.category || 'Sem categoria';
    if (!porCategoria.has(categoria)) porCategoria.set(categoria, { total: 0, pos: new Set() });
    const entrada = porCategoria.get(categoria);
    entrada.total += num(it.lineTotal);
    entrada.pos.add(it.purchaseOrderId);
  }

  const oportunidades = [];
  for (const [categoria, { total, pos }] of porCategoria.entries()) {
    const numeroPos = pos.size;
    // Exige fragmentação real: uma única PO grande já não é "consolidável".
    if (numeroPos < 3) continue;
    const proximo = patamares.find((t) => t.minVolumeUsd > total);
    if (!proximo) continue; // já está no maior patamar ativo
    const faltamUsd = proximo.minVolumeUsd - total;
    const mediaPorPo = total / numeroPos;
    // Só é uma "oportunidade" se o que falta é do tamanho de uma compra
    // típica desta categoria — não uma promessa distante e inatingível.
    if (faltamUsd > 0 && faltamUsd <= mediaPorPo) {
      oportunidades.push({
        categoria,
        volumeAtual: total,
        numeroPos,
        proximoThresholdUsd: proximo.minVolumeUsd,
        descontoPotencial: proximo.discountPercent,
        faltamUsd: Math.round(faltamUsd * 100) / 100,
      });
    }
  }
  return oportunidades.sort((a, b) => a.faltamUsd - b.faltamUsd);
}

module.exports = {
  volumePorCategoria,
  historicoMensalPorProduto,
  mediaMensalPorProduto,
  previsaoNecessidade,
  oportunidadesConsolidacao,
};
