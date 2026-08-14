// src/services/conteudoLocalService.js
// Relatório de conteúdo local.
//
// PARA QUE SERVE: o setor petrolífero angolano tem obrigações de conteúdo local
// — comprar a empresas angolanas, e em particular a MPME angolanas. Provar o
// cumprimento é hoje um trabalho manual de juntar ordens de compra numa folha
// de cálculo. A KIXIMA já tem esses dados estruturados, com o NIF e a dimensão
// de cada fornecedor confirmados na credenciação.
//
// NÃO EXISTE MODELO OFICIAL. Este é um desenho proposto, não a reprodução de um
// formulário da ANPG. Está construído para ser defensável e para poder mudar:
// as métricas estão isoladas em funções próprias e os totais são sempre
// reconstituíveis a partir do anexo.
//
// AS TRÊS PERGUNTAS, e porque são três e não uma:
//
//   1. CONTRATAÇÃO NACIONAL — quanto do valor foi contratado a empresas
//      registadas em Angola. É o número da capa, o mais fácil de calcular e o
//      mais fácil de contestar.
//
//   2. ORIGEM DO BEM — desse valor, quanto corresponde a bens de origem
//      angolana, e quanto é importação passada por um intermediário local.
//      É esta a pergunta que separa conteúdo local a sério de uma empresa de
//      trading com morada em Luanda. Um relatório que só responda à primeira
//      pergunta é um número de vaidade; quem o receber vai fazer esta segunda,
//      e é melhor que a resposta já lá esteja.
//
//   3. MPME ANGOLANA — quanto foi para micro, pequenas e médias empresas
//      angolanas. É o propósito declarado da plataforma, e a métrica que
//      distingue comprar a uma multinacional com filial local de fazer crescer
//      a cadeia de fornecimento nacional.
//
// E UMA REGRA: cada percentagem tem de ser reconstituível. O relatório traz o
// anexo com as ordens que o compõem, porque um número que não se consegue
// justificar linha a linha não serve para entregar a um regulador.
const prisma = require('../config/database');
const { BusinessRuleError } = require('../utils/errors');

// Só entram ordens com compromisso financeiro real. Uma ordem por aprovar ou
// recusada não é compra nenhuma, e inflacionaria o relatório com intenções.
const ESTADOS_CONTAM = [
  'ACEITE_FORNECEDOR', 'AGUARDANDO_PAGAMENTO', 'PAGA', 'EM_EXECUCAO',
  'ENTREGUE', 'RECEBIDA_CONFORME', 'RECEBIDA_COM_DIVERGENCIA', 'CONCLUIDA',
];

const ANGOLA = 'angola';
const MPME = ['MICRO', 'PEQUENA', 'MEDIA'];

const ePais = (valor, pais) => String(valor || '').trim().toLowerCase() === pais;
const eAngolana = (empresa) => ePais(empresa?.country, ANGOLA);

// Valor SEM IVA. O imposto é do Estado, não do fornecedor: incluí-lo inflaciona
// o conteúdo local com dinheiro que nunca foi para a cadeia de fornecimento.
function valorDaOrdem(po) {
  return Number(po.netAmount ?? po.totalAmount ?? 0);
}

function percentagem(parte, total) {
  if (!total) return 0;
  return Math.round((parte / total) * 1000) / 10;   // uma casa decimal
}

/**
 * Origem do valor de UMA ordem, ao nível da linha.
 *
 * Não se pode responder à pergunta 2 ao nível da ordem: uma ordem pode misturar
 * um bem fabricado em Angola com outro importado. É por linha que a resposta é
 * honesta.
 *
 * Uma linha sem país de origem declarado NÃO conta como angolana. O desconhecido
 * não pode contar a favor de quem reporta — se contasse, bastava deixar o campo
 * em branco para o relatório melhorar.
 */
function origemDasLinhas(po) {
  const bruto = Number(po.totalAmount ?? 0);
  const liquido = valorDaOrdem(po);
  // Fator para converter valores de linha (sem IVA na origem) na mesma base do
  // total da ordem, quando a ordem traz IVA.
  const escala = bruto && liquido ? liquido / bruto : 1;

  let angolana = 0;
  let importada = 0;
  let porDeclarar = 0;

  for (const item of po.items || []) {
    const linha = Number(item.lineTotal ?? 0) * (liquido && !po.netAmount ? escala : 1);
    const origem = item.product?.countryOfOrigin;
    if (!String(origem || '').trim()) porDeclarar += linha;
    else if (ePais(origem, ANGOLA)) angolana += linha;
    else importada += linha;
  }
  return { angolana, importada, porDeclarar };
}

/**
 * Relatório de um período.
 * @param companyId  a empresa que reporta (a compradora)
 * @param de/ate     início e fim do período (ISO). O fim é inclusivo.
 */
async function gerar(companyId, { de, ate } = {}) {
  const inicio = de ? new Date(de) : new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
  const fim = ate ? new Date(ate) : new Date();
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
    throw new BusinessRuleError('Datas inválidas. Use o formato AAAA-MM-DD.');
  }
  if (inicio > fim) throw new BusinessRuleError('A data de início é posterior à data de fim.');
  // Inclui o dia de fim por inteiro — quem escreve 31/12 espera que o 31 conte.
  const fimInclusivo = new Date(fim.getTime());
  fimInclusivo.setUTCHours(23, 59, 59, 999);

  const ordens = await prisma.purchaseOrder.findMany({
    where: {
      buyerCompanyId: companyId,
      status: { in: ESTADOS_CONTAM },
      createdAt: { gte: inicio, lte: fimInclusivo },
    },
    select: {
      reference: true, status: true, createdAt: true, currency: true,
      totalAmount: true, netAmount: true,
      supplierCompany: { select: { id: true, name: true, taxId: true, country: true, province: true, size: true } },
      items: {
        select: {
          lineTotal: true,
          product: { select: { name: true, category: true, countryOfOrigin: true, unspscSegment: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const total = ordens.reduce((s, po) => s + valorDaOrdem(po), 0);

  // --- 1. Contratação nacional ----------------------------------------------
  const nacional = ordens.filter((po) => eAngolana(po.supplierCompany))
    .reduce((s, po) => s + valorDaOrdem(po), 0);

  // --- 2. Origem do bem ------------------------------------------------------
  const origem = ordens.reduce((acc, po) => {
    const o = origemDasLinhas(po);
    acc.angolana += o.angolana;
    acc.importada += o.importada;
    acc.porDeclarar += o.porDeclarar;
    return acc;
  }, { angolana: 0, importada: 0, porDeclarar: 0 });

  // --- 3. MPME angolana ------------------------------------------------------
  const mpme = ordens
    .filter((po) => eAngolana(po.supplierCompany) && MPME.includes(po.supplierCompany?.size))
    .reduce((s, po) => s + valorDaOrdem(po), 0);

  // --- Por categoria: onde há substituição possível --------------------------
  // A leitura útil não é "compramos 60% local". É "nesta categoria compramos
  // 5% local" — que é onde há trabalho de desenvolvimento de fornecedores a
  // fazer, e é o que a KIXIMA existe para resolver.
  const categorias = new Map();
  for (const po of ordens) {
    const nac = eAngolana(po.supplierCompany);
    for (const item of po.items || []) {
      const chave = item.product?.category || 'Sem categoria';
      const linha = Number(item.lineTotal ?? 0);
      const c = categorias.get(chave) || { categoria: chave, total: 0, nacional: 0 };
      c.total += linha;
      if (nac) c.nacional += linha;
      categorias.set(chave, c);
    }
  }
  const porCategoria = [...categorias.values()]
    .map((c) => ({ ...c, percentagemNacional: percentagem(c.nacional, c.total) }))
    .sort((a, b) => b.total - a.total);

  // --- Fornecedores nacionais, por valor -------------------------------------
  const fornecedores = new Map();
  for (const po of ordens) {
    const f = po.supplierCompany;
    if (!f) continue;
    const atual = fornecedores.get(f.id) || {
      nome: f.name, nif: f.taxId, pais: f.country, provincia: f.province,
      dimensao: f.size, nacional: eAngolana(f), valor: 0, ordens: 0,
    };
    atual.valor += valorDaOrdem(po);
    atual.ordens += 1;
    fornecedores.set(f.id, atual);
  }

  const empresa = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true, taxId: true, province: true },
  });

  return {
    empresa,
    periodo: { de: inicio, ate: fimInclusivo },
    moeda: ordens[0]?.currency || 'AOA',
    // O relatório diz o que conta e o que não conta. Sem isto, dois relatórios
    // com o mesmo título dariam números diferentes e ninguém saberia porquê.
    criterio: {
      estadosIncluidos: ESTADOS_CONTAM,
      baseDeCalculo: 'Valor sem IVA. O imposto é do Estado, não da cadeia de fornecimento.',
      origemPorDeclarar: 'Linhas sem país de origem declarado NÃO contam como angolanas.',
    },
    totais: {
      valorTotal: total,
      ordens: ordens.length,
      fornecedores: fornecedores.size,
    },
    contratacaoNacional: {
      valor: nacional,
      percentagem: percentagem(nacional, total),
      descricao: 'Valor contratado a empresas registadas em Angola.',
    },
    origemDoBem: {
      angolana: origem.angolana,
      importada: origem.importada,
      porDeclarar: origem.porDeclarar,
      percentagemAngolana: percentagem(origem.angolana, total),
      descricao: 'Do valor comprado, quanto corresponde a bens de origem angolana — '
        + 'e quanto é importação através de um intermediário local.',
    },
    mpmeAngolana: {
      valor: mpme,
      percentagem: percentagem(mpme, total),
      descricao: 'Valor contratado a micro, pequenas e médias empresas angolanas (Lei n.º 30/11).',
    },
    // QUALIDADE DOS DADOS. Um relatório onde metade do valor não tem origem
    // declarada não é um relatório de 50% — é um relatório que não se pode
    // entregar. Dizê-lo aqui evita que alguém o envie a um regulador sem
    // reparar, e transforma o problema em algo acionável: são estes os
    // fornecedores a quem falta pedir a informação.
    qualidadeDosDados: (() => {
      const semOrigem = percentagem(origem.porDeclarar, total);
      return {
        valorSemOrigemDeclarada: origem.porDeclarar,
        percentagemSemOrigem: semOrigem,
        confiavel: semOrigem <= 10,
        aviso: semOrigem > 10
          ? `${semOrigem}% do valor não tem país de origem declarado nos produtos. `
            + 'Enquanto assim for, a linha "origem do bem" está subavaliada e o relatório '
            + 'não deve ser entregue como prova de conteúdo local. Peça aos fornecedores '
            + 'que preencham o país de origem na ficha de cada item.'
          : null,
      };
    })(),
    porCategoria,
    fornecedores: [...fornecedores.values()].sort((a, b) => b.valor - a.valor),
    // O anexo é o que torna o relatório defensável: cada número acima
    // reconstitui-se a partir daqui.
    anexo: ordens.map((po) => ({
      referencia: po.reference,
      data: po.createdAt,
      estado: po.status,
      fornecedor: po.supplierCompany?.name,
      nif: po.supplierCompany?.taxId,
      paisDoFornecedor: po.supplierCompany?.country,
      dimensao: po.supplierCompany?.size,
      valorSemIva: valorDaOrdem(po),
      origem: origemDasLinhas(po),
    })),
  };
}

module.exports = { gerar, ESTADOS_CONTAM };
