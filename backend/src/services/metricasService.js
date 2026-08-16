// src/services/metricasService.js
// Métricas de NEGÓCIO — as que dizem se a plataforma está a funcionar.
//
// O Sentry já cobre o que se parte. Não cobre o que apenas deixa de acontecer,
// e é aí que uma plataforma B2B morre em silêncio: as cotações continuam a
// entrar e param de virar ordens; os pagamentos continuam a ser confirmados,
// mas cada vez mais tarde. Nada disso lança uma exceção. Não há erro nenhum
// para o Sentry apanhar — há um número que baixa durante semanas.
//
// TRÊS NÚMEROS E NÃO TRINTA. Um painel com trinta indicadores não se olha. Cada
// um destes responde a uma pergunta que alguém faria em voz alta:
//   1. Está a passar dinheiro por aqui?          → volume transacionado
//   2. O marketplace está a fechar negócio?      → cotação que vira ordem
//   3. O "pagamento garantido" está a cumprir?   → tempo até confirmação
//
// O terceiro é o mais importante e o menos óbvio. É a promessa do produto, é o
// que a conciliação automática existe para melhorar, e é o único que diz se
// valeu a pena — sem ele, KX-05 é uma funcionalidade sem forma de saber se
// resolveu alguma coisa.

const prisma = require('../config/database');

const PAGAS = ['PAGA', 'EM_EXECUCAO', 'ENTREGUE', 'RECEBIDA_CONFORME', 'RECEBIDA_COM_DIVERGENCIA', 'CONCLUIDA'];

function janela(dias = 30, agora = new Date()) {
  const de = new Date(agora);
  de.setDate(de.getDate() - dias);
  return { de, ate: agora };
}

/** Mediana e não média: um único negócio enorme desloca a média e não desloca a mediana. */
function mediana(valores) {
  if (!valores.length) return null;
  const ord = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ord.length / 2);
  return ord.length % 2 ? ord[meio] : (ord[meio - 1] + ord[meio]) / 2;
}

async function volumeTransacionado({ de, ate }) {
  const agg = await prisma.purchaseOrder.aggregate({
    where: { createdAt: { gte: de, lte: ate }, status: { in: PAGAS } },
    _sum: { totalAmount: true },
    _count: { _all: true },
  });
  return {
    ordens: agg._count._all,
    total: Number(agg._sum.totalAmount || 0),
    // O ticket médio explica o total: 10 ordens de 1M não é o mesmo negócio que
    // 1000 de 10 mil, e o total sozinho não distingue os dois.
    ticketMedio: agg._count._all ? Number(agg._sum.totalAmount || 0) / agg._count._all : 0,
  };
}

/**
 * Quantos pedidos de cotação acabam em ordem.
 *
 * Conta-se pelas cotações CRIADAS na janela, e não pelas ordens: uma cotação
 * pedida hoje pode virar ordem daqui a três semanas, e dividir ordens desta
 * semana por cotações desta semana produz um número que sobe e desce sozinho
 * sem nada ter mudado.
 */
async function conversaoDeCotacoes({ de, ate }) {
  const [pedidas, respondidas, fechadas] = await Promise.all([
    prisma.quoteRequest.count({ where: { createdAt: { gte: de, lte: ate } } }),
    prisma.quoteRequest.count({ where: { createdAt: { gte: de, lte: ate }, status: { in: ['RESPONDIDA', 'FECHADA'] } } }),
    prisma.quoteRequest.count({ where: { createdAt: { gte: de, lte: ate }, status: 'FECHADA' } }),
  ]);

  const pct = (n) => (pedidas ? Math.round((n / pedidas) * 1000) / 10 : null);
  return {
    pedidas,
    respondidas,
    fechadas,
    // Duas taxas e não uma: se as cotações não fecham, é preciso saber se é
    // porque os fornecedores não respondem ou porque respondem e não convence.
    taxaDeResposta: pct(respondidas),
    taxaDeFecho: pct(fechadas),
  };
}

/**
 * Quanto tempo entre a fatura ser emitida e o pagamento entrar.
 *
 * É a métrica que mede a promessa do produto. Separada POR CANAL de propósito:
 * é assim que se vê se a conciliação automática está a valer alguma coisa — se
 * a mediana da referência bancária não for muito menor do que a da
 * transferência manual, KX-05 não resolveu o que dizia resolver.
 */
async function tempoAteConfirmacao({ de, ate }) {
  const pagamentos = await prisma.payment.findMany({
    where: { processedAt: { gte: de, lte: ate }, status: 'PROCESSADO' },
    select: { processedAt: true, canal: true, invoice: { select: { issuedAt: true } } },
    take: 20000,
  });

  const horasPorCanal = new Map();
  for (const p of pagamentos) {
    if (!p.invoice?.issuedAt) continue;
    const horas = (new Date(p.processedAt) - new Date(p.invoice.issuedAt)) / 3600000;
    if (horas < 0) continue; // dados incoerentes não entram na conta
    if (!horasPorCanal.has(p.canal)) horasPorCanal.set(p.canal, []);
    horasPorCanal.get(p.canal).push(horas);
  }

  const todas = [...horasPorCanal.values()].flat();
  const arredondar = (h) => (h == null ? null : Math.round(h * 10) / 10);

  return {
    pagamentos: todas.length,
    medianaHoras: arredondar(mediana(todas)),
    porCanal: Object.fromEntries(
      [...horasPorCanal.entries()].map(([canal, hs]) => [canal, {
        pagamentos: hs.length,
        medianaHoras: arredondar(mediana(hs)),
      }]),
    ),
  };
}

/**
 * O que a conciliação NÃO conseguiu resolver sozinha.
 *
 * Se este número só cresce, o formato da descrição do banco mudou e ninguém
 * deu por isso — e o trabalho manual voltou todo, devagar, sem aviso.
 */
async function conciliacaoAutomatica({ de, ate }) {
  const [conciliadas, porResolver] = await Promise.all([
    prisma.linhaExtrato.count({ where: { importadaEm: { gte: de, lte: ate }, estado: 'CONCILIADA' } }),
    prisma.linhaExtrato.count({
      where: { importadaEm: { gte: de, lte: ate }, estado: { in: ['SEM_CORRESPONDENCIA', 'DIVERGENTE'] } },
    }),
  ]);
  const total = conciliadas + porResolver;
  return {
    linhas: total,
    conciliadas,
    porResolver,
    taxaAutomatica: total ? Math.round((conciliadas / total) * 1000) / 10 : null,
  };
}

async function resumo({ dias = 30 } = {}) {
  // Calculado UMA vez e reutilizado. Estava a ser validado para a janela e
  // repetido em bruto no período relatado, por isso um `dias=-5` media 30 dias
  // e dizia -5. Uma métrica que declara um período diferente daquele que mediu
  // é pior do que não existir: quem a lê compara-a com outra coisa.
  const pedido = Math.floor(Number(dias));
  const diasEfetivos = Number.isFinite(pedido) && pedido > 0 ? pedido : 30;
  const periodo = janela(diasEfetivos);
  const [volume, cotacoes, tempo, conciliacao] = await Promise.all([
    volumeTransacionado(periodo),
    conversaoDeCotacoes(periodo),
    tempoAteConfirmacao(periodo),
    conciliacaoAutomatica(periodo),
  ]);

  return {
    periodo: { de: periodo.de.toISOString(), ate: periodo.ate.toISOString(), dias: diasEfetivos },
    volume,
    cotacoes,
    tempoAteConfirmacao: tempo,
    conciliacao,
  };
}

module.exports = { resumo, volumeTransacionado, conversaoDeCotacoes, tempoAteConfirmacao, conciliacaoAutomatica, mediana };
