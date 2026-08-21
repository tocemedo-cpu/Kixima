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
// Fica inerte até `KIXIMA_SERIE_FATURACAO` estar definida. Sem essa variável, as
// faturas continuam a ser emitidas exatamente como hoje, sem série e sem hash —
// e distinguem-se por `serie IS NULL`. É deliberado: ligar isto a meio, sem a
// série declarada, produziria documentos numerados numa série que não existe.

const crypto = require('crypto');
const prisma = require('../config/database');
const config = require('../config/env');

// Lida a CADA chamada, e não capturada no arranque do módulo: assim a série
// pode ser ligada e desligada em testes sem recarregar o processo, e o valor é
// sempre o que a configuração diz agora.
function serieAtual() {
  return config.faturacao.serie || null;
}

function ativa() {
  return Boolean(serieAtual());
}

// A série da nota de crédito é INDEPENDENTE da série da fatura — cada tipo de
// documento tem a sua própria cadeia. Mesma regra de desligado por omissão:
// sem KIXIMA_SERIE_NOTA_CREDITO definida, `atribuir(tx, { codigo: null })`
// devolve {} e a nota de crédito sai sem série nem hash, exatamente como a
// fatura sai hoje sem a sua.
function serieNotaCreditoAtual() {
  return config.faturacao.serieNotaCredito || null;
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
 * `codigo`: a fatura usa a série de faturação (serieAtual(), por omissão); a
 * nota de crédito passa a SUA PRÓPRIA série (KIXIMA_SERIE_NOTA_CREDITO) —
 * são cadeias de integridade distintas, e misturá-las na mesma série faria
 * o hash de uma fatura agarrar-se ao de uma nota de crédito (ou vice-versa),
 * o que não corresponde a nenhum documento real. O mecanismo de baixo
 * (bloqueio + série+ano) é o MESMO para os dois — só o código da série muda.
 */
async function atribuir(tx, { emitidaEm, total, codigo } = {}) {
  const SERIE = codigo || serieAtual();
  if (!SERIE) return {};

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
async function verificarCadeia(codigo = null, ano = new Date().getFullYear()) {
  codigo = codigo || serieAtual();
  if (!codigo) return { serie: null, verificada: false, motivo: 'Faturação certificada desativada.' };

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
  ativa, atribuir, verificarCadeia, calcularHash, textoParaAssinar, serieAtual, serieNotaCreditoAtual,
};
