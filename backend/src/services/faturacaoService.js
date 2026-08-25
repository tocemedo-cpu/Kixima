// src/services/faturacaoService.js
// Numeração certificada e cadeia de integridade das faturas (base AGT).
//
// O QUE ISTO É E O QUE NÃO É. A certificação junto da AGT é um processo
// administrativo — número de certificado do programa, formato do documento,
// validação do modelo. Isso depende de decisão do contabilista e não se escreve
// em código. O que se escreve aqui é a parte que tem de estar certa desde a
// PRIMEIRA fatura emitida, porque não se corrige para trás: a numeração
// sequencial sem buracos e a cadeia que permite provar que nada foi alterado.
//
// A SÉRIE É POR FORNECEDOR, NÃO GLOBAL. Cada empresa fornecedora é o emitente
// fiscal das suas próprias faturas — a KIXIMA nunca compra para revender, só
// garante o pagamento (ver termos da PO/fatura). Partilhar uma série entre
// fornecedores diferentes intercalaria a numeração de empresas distintas, o
// que não corresponde a nenhum documento fiscal real de nenhuma delas. Por
// isso a série vive em `Company.serieFiscal`, não numa variável de ambiente
// global: fica inerte por empresa até essa empresa ter a sua série declarada
// à AGT — desligado por omissão, exatamente como antes, só que ao nível certo.

const crypto = require('crypto');
const prisma = require('../config/database');
const taxService = require('./taxService');

function serieFiscalDoFornecedor(supplierCompany) {
  return supplierCompany?.serieFiscal || null;
}

// A série da nota de crédito é INDEPENDENTE da série da fatura — cada tipo de
// documento tem a sua própria cadeia, mas ambas pertencem ao MESMO fornecedor.
// Sufixo "-NC" da série de faturas dessa empresa: sem duplicar a coluna,
// garante que nunca é a mesma série (e continua desligada por omissão,
// porque sem serieFiscal não há "-NC" nenhum a computar).
function serieNotaCreditoDoFornecedor(supplierCompany) {
  const base = serieFiscalDoFornecedor(supplierCompany);
  return base ? `${base}-NC` : null;
}

// O recibo é o documento "RC" da AGT (ver especificação DS.120) — série
// própria, sufixo "-RC", mesma lógica que a nota de crédito.
function serieReciboDoFornecedor(supplierCompany) {
  const base = serieFiscalDoFornecedor(supplierCompany);
  return base ? `${base}-RC` : null;
}

// Classificação fixa da única taxa de IVA que o KIXIMA aplica hoje (14%,
// sempre) — a AGT exige que toda linha de IVA declare um destes códigos
// (NOR/INT/RED/ISE/OUT), mesmo quando a taxa é a normal. Nomeia o que já
// existe; não introduz nenhuma isenção ou taxa reduzida que não aconteça.
const AGT_TAX_CODE_NORMAL = 'NOR';

// Formato do número do documento fiscal, conforme o modelo impresso de
// referência da AGT (FACTURA.png, Portal do Contribuinte): série + ano +
// sequencial com 7 dígitos — ex. "000AB.2025/0000001". Sem série atribuída
// (documento anterior à série certificada), devolve null.
function numeroDocumentoAGT({ serie, ano, numeroNaSerie } = {}) {
  if (!serie || !numeroNaSerie) return null;
  return `${serie}.${ano}/${String(numeroNaSerie).padStart(7, '0')}`;
}

// Regra de arredondamento da AGT para o imposto de cada linha (secção 4.1.6
// da DS.120): sempre POR EXCESSO ao cêntimo, nunca ao mais próximo. Função
// pura — não está ligada ao cálculo de faturação em vigor (taxService.js
// continua a arredondar ao mais próximo para o que já se cobra hoje); fica
// pronta para quando a exportação/submissão real usar esta regra.
function arredondarPorExcessoAoCentimo(valor) {
  return Math.ceil((Number(valor) + Number.EPSILON) * 100) / 100;
}

// Constrói as linhas da fatura (documento AGT — ver FACTURA.png de
// referência) a partir das linhas de uma PO ou de vários call-offs
// consolidados. Partilhada por poService e contractService para não
// duplicar a mesma decomposição de imposto por linha nos dois sítios.
// `iecAmount`/`isAmount` ficam a 0 por omissão (schema): nenhuma linha real
// do KIXIMA hoje é sujeita a esses impostos.
function linhasFaturaAGT(items) {
  return items.map((li, i) => {
    const net = Number(li.lineTotal);
    const iva = taxService.computeTax(net);
    return {
      lineNumber: i + 1,
      productCode: li.product?.sku || li.product?.unspscCode || li.productId,
      description: li.product?.name || 'Produto/serviço',
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      netAmount: net,
      ivaAmount: iva.tax,
      ivaTaxCode: AGT_TAX_CODE_NORMAL,
    };
  });
}

/**
 * A cadeia de integridade.
 *
 * Cada documento assina o hash do anterior. Alterar uma fatura já emitida —
 * o valor, a data, o destinatário — muda o seu hash e parte a cadeia em todos
 * os documentos seguintes. Não impede a alteração (nada, num sistema, impede
 * quem tem acesso à base); torna-a DETETÁVEL, que é o que uma inspeção precisa.
 *
 * O formato do texto assinado segue o modelo português em que a AGT se baseia:
 * data de emissão, data do documento, identificador, total, hash anterior.
 * Separado por ';' e sem espaços — a ordem e o separador fazem parte do que
 * torna o hash reproduzível por quem verifica.
 */
function textoParaAssinar({ emitidaEm, serie, numero, total, hashAnterior }) {
  const data = new Date(emitidaEm).toISOString().slice(0, 10);
  const carimbo = new Date(emitidaEm).toISOString().slice(0, 19);
  const montante = Number(total).toFixed(2);
  return [data, carimbo, `${serie}/${numero}`, montante, hashAnterior || ''].join(';');
}

function calcularHash(dados) {
  return crypto.createHash('sha256').update(textoParaAssinar(dados), 'utf8').digest('base64');
}

/**
 * Atribui série, número e hash a um documento fiscal, DENTRO da transação
 * que o cria.
 *
 * O `tx` não é opcional e não é um detalhe de implementação: é o mecanismo
 * inteiro. O `SELECT ... FOR UPDATE` bloqueia a linha da série até ao fim da
 * transação, por isso duas emissões simultâneas ficam em fila em vez de
 * receberem o mesmo número. E se a transação abortar depois disto, o
 * incremento desaparece com ela — o número volta a estar livre e não fica
 * buraco nenhum.
 *
 * É mais lento do que um contador independente, de propósito: os documentos de
 * uma série são, por definição, uma fila. Um contador que não serializa é mais
 * rápido e produz exatamente a avaria que aqui não pode acontecer.
 *
 * `codigo`: sempre explícito, resolvido por quem chama a partir do
 * fornecedor do documento — `serieFiscalDoFornecedor(supplierCompany)` para
 * a fatura, `serieNotaCreditoDoFornecedor(supplierCompany)` para a nota de
 * crédito. São cadeias de integridade distintas (fatura vs. nota de crédito)
 * e isoladas por empresa (fornecedor A vs. fornecedor B); misturá-las faria o
 * hash de um documento agarrar-se ao de outro que não é o seu antecessor
 * real. O mecanismo de baixo (bloqueio + série+ano) é o MESMO para todos —
 * só o código da série muda.
 *
 * `dataAdesao`: a data de adesão da empresa à faturação eletrónica
 * (`Company.dataAdesaoFacturacaoElectronica`), resolvida por quem chama a
 * partir do mesmo fornecedor que já resolve `codigo`. Um documento datado
 * antes da adesão é recusado — a mesma regra que a AGT aplica (erro E29 da
 * especificação DS.120). Sem data definida, sem restrição nenhuma.
 */
async function atribuir(tx, { emitidaEm, total, codigo, dataAdesao } = {}) {
  const SERIE = codigo || null;
  if (!SERIE) return {};

  if (dataAdesao && new Date(emitidaEm) < new Date(dataAdesao)) {
    throw new Error(
      `Data de emissão (${new Date(emitidaEm).toISOString().slice(0, 10)}) anterior à data de `
      + `adesão da empresa à faturação eletrónica (${new Date(dataAdesao).toISOString().slice(0, 10)}).`
    );
  }

  const ano = new Date(emitidaEm).getFullYear();

  // A série tem de existir antes de se bloquear. Criada de forma idempotente:
  // duas emissões simultâneas na primeira fatura do ano não podem falhar uma
  // contra a outra.
  await tx.$executeRaw`
    INSERT INTO "series_faturacao" ("id", "codigo", "ano", "ultimo_numero")
    VALUES (gen_random_uuid()::text, ${SERIE}, ${ano}, 0)
    ON CONFLICT ("codigo", "ano") DO NOTHING
  `;

  const [linha] = await tx.$queryRaw`
    SELECT "ultimo_numero", "ultimo_hash", "ativa"
      FROM "series_faturacao"
     WHERE "codigo" = ${SERIE} AND "ano" = ${ano}
     FOR UPDATE
  `;

  if (!linha.ativa) {
    throw new Error(`A série de faturação ${SERIE}/${ano} está fechada. Não se emitem documentos numa série fechada.`);
  }

  const numero = Number(linha.ultimo_numero) + 1;
  const hashAnterior = linha.ultimo_hash || null;
  const hashDocumento = calcularHash({ emitidaEm, serie: SERIE, numero, total, hashAnterior });

  await tx.$executeRaw`
    UPDATE "series_faturacao"
       SET "ultimo_numero" = ${numero}, "ultimo_hash" = ${hashDocumento}, "updated_at" = NOW()
     WHERE "codigo" = ${SERIE} AND "ano" = ${ano}
  `;

  return {
    serie: SERIE,
    numeroNaSerie: numero,
    hashDocumento,
    hashAnterior,
    assinadaEm: new Date(emitidaEm),
  };
}

/**
 * Verifica a cadeia inteira de uma série.
 *
 * Devolve o que encontrou em vez de lançar: quem chama isto está a investigar,
 * e uma exceção no primeiro problema esconderia os restantes. Um relatório de
 * integridade que pára no primeiro erro obriga a corrê-lo N vezes para ver N
 * problemas.
 */
async function verificarCadeia(codigo, ano = new Date().getFullYear()) {
  if (!codigo) return { serie: null, verificada: false, motivo: 'Indique a série a verificar (é por fornecedor, já não há uma série global única).' };

  const faturas = await prisma.invoice.findMany({
    where: { serie: codigo, numeroNaSerie: { not: null } },
    orderBy: { numeroNaSerie: 'asc' },
    select: {
      id: true, reference: true, numeroNaSerie: true, amount: true,
      issuedAt: true, hashDocumento: true, hashAnterior: true,
    },
    take: 100000,
  });

  const problemas = [];
  let esperado = null;

  for (const [i, f] of faturas.entries()) {
    // Buracos na numeração: o que a série toda existe para impedir.
    const numeroEsperado = i + 1;
    if (f.numeroNaSerie !== numeroEsperado) {
      problemas.push({
        tipo: 'BURACO_NA_NUMERACAO',
        fatura: f.reference,
        detalhe: `esperava o número ${numeroEsperado} e encontrou ${f.numeroNaSerie}`,
      });
    }

    if ((f.hashAnterior || null) !== esperado) {
      problemas.push({
        tipo: 'ELO_PARTIDO',
        fatura: f.reference,
        detalhe: 'o hash anterior não corresponde ao documento que a precede',
      });
    }

    const recalculado = calcularHash({
      emitidaEm: f.issuedAt,
      serie: codigo,
      numero: f.numeroNaSerie,
      total: f.amount,
      hashAnterior: f.hashAnterior,
    });
    if (recalculado !== f.hashDocumento) {
      problemas.push({
        tipo: 'DOCUMENTO_ALTERADO',
        fatura: f.reference,
        detalhe: 'o hash não bate com o conteúdo — a fatura foi alterada depois de emitida',
      });
    }

    esperado = f.hashDocumento;
  }

  return {
    serie: codigo,
    ano,
    documentos: faturas.length,
    integra: problemas.length === 0,
    problemas,
  };
}

module.exports = {
  atribuir, verificarCadeia, calcularHash, textoParaAssinar,
  serieFiscalDoFornecedor, serieNotaCreditoDoFornecedor, serieReciboDoFornecedor,
  numeroDocumentoAGT, arredondarPorExcessoAoCentimo, AGT_TAX_CODE_NORMAL, linhasFaturaAGT,
};
