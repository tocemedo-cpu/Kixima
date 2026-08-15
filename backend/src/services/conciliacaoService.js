// src/services/conciliacaoService.js
// Referência bancária e conciliação automática do extrato.
//
// A PROMESSA DO PRODUTO é pagamento garantido. Até aqui a garantia era uma
// pessoa do Financeiro a abrir um PDF: funciona, e não escala. O momento em que
// deixa de escalar é o momento em que há volume — o pior momento para descobrir.
//
// A referência bancária é o caminho mais curto até uma confirmação sem toque
// humano, e não depende de contrato com gateway nenhum: cada fatura ganha uma
// referência única, o banco devolve o extrato, e as linhas casam sozinhas.
//
// A REGRA QUE GOVERNA TUDO AQUI: na dúvida, NÃO se dá por paga. Uma fatura
// marcada como paga por engano é dinheiro que o fornecedor espera e não vem, e
// a plataforma passou a mentir sobre a única coisa que promete. Uma linha que
// não casa fica a aguardar decisão humana — que é o estado em que TUDO estava
// antes, por isso não se perde nada por não adivinhar.

const prisma = require('../config/database');
const { NotFoundError, BusinessRuleError } = require('../utils/errors');
const auditService = require('./auditService');

const ESTADOS = {
  POR_CONCILIAR: 'POR_CONCILIAR',
  CONCILIADA: 'CONCILIADA',
  SEM_CORRESPONDENCIA: 'SEM_CORRESPONDENCIA',
  DIVERGENTE: 'DIVERGENTE',
};

/**
 * A referência que o pagador escreve na transferência.
 *
 * Curta e sem caracteres ambíguos de propósito: é lida em voz alta ao balcão e
 * escrita à mão num formulário do banco. O alfabeto exclui O, I, 0 e 1 — os
 * quatro que se trocam entre si e produzem uma transferência que chega ao banco
 * e não casa com fatura nenhuma. Nesse caso o dinheiro entrou, o comprador
 * jura que pagou, e ninguém consegue explicar porquê.
 */
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function gerarReferencia() {
  let s = '';
  const bytes = require('crypto').randomBytes(10);
  for (let i = 0; i < 10; i += 1) s += ALFABETO[bytes[i] % ALFABETO.length];
  return `KX${s.slice(0, 4)}-${s.slice(4, 8)}`;
}

/**
 * Atribui uma referência única a uma fatura.
 *
 * Repete-se em caso de colisão em vez de confiar na sorte: o espaço é grande
 * (32^8), mas "grande" não é "impossível", e uma colisão aqui seria um pagamento
 * creditado à fatura errada — o pior resultado possível deste módulo.
 */
async function atribuirReferencia(invoiceId, tx = prisma) {
  for (let tentativa = 0; tentativa < 5; tentativa += 1) {
    const referencia = gerarReferencia();
    const existe = await tx.invoice.findUnique({
      where: { referenciaPagamento: referencia }, select: { id: true },
    });
    if (existe) continue;
    await tx.invoice.update({ where: { id: invoiceId }, data: { referenciaPagamento: referencia } });
    return referencia;
  }
  throw new Error('Não foi possível gerar uma referência de pagamento única após 5 tentativas.');
}

/**
 * Extrai a referência da descrição de uma linha do extrato.
 *
 * O banco devolve a descrição como o pagador a escreveu: com espaços a mais,
 * em minúsculas, sem o hífen, com a referência no meio de outro texto. Aceitar
 * só o formato exato faria falhar a maioria das transferências reais — e cada
 * falha dessas é trabalho manual que este módulo existe para eliminar.
 */
function extrairReferencia(descricao) {
  const limpo = String(descricao || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = limpo.match(/KX([ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8})/);
  return m ? `KX${m[1].slice(0, 4)}-${m[1].slice(4, 8)}` : null;
}

/**
 * Importa linhas do extrato e tenta conciliar cada uma.
 *
 * Idempotente por `idNoBanco`: reenviar o mesmo extrato é uma ocorrência banal
 * (o banco reenvia, alguém carrega duas vezes o mesmo ficheiro), e não pode
 * pagar a mesma fatura duas vezes.
 */
async function importarExtrato(linhas, actor = null) {
  const resultado = { importadas: 0, repetidas: 0, conciliadas: 0, porResolver: 0, detalhes: [] };

  for (const bruta of linhas) {
    const idNoBanco = String(bruta.idNoBanco || '').trim();
    if (!idNoBanco) throw new BusinessRuleError('Cada linha do extrato precisa de um identificador do banco.');

    const jaExiste = await prisma.linhaExtrato.findUnique({ where: { idNoBanco } });
    if (jaExiste) {
      resultado.repetidas += 1;
      continue;
    }

    const montante = Number(bruta.montante);
    const referencia = bruta.referencia || extrairReferencia(bruta.descricao);

    // Só entram entradas de dinheiro. Um débito com uma referência na descrição
    // não é um pagamento — e creditá-lo seria dar por paga uma fatura com o
    // dinheiro a SAIR.
    const credito = montante > 0;

    const criada = await prisma.linhaExtrato.create({
      data: {
        idNoBanco,
        dataValor: new Date(bruta.dataValor),
        montante,
        moeda: bruta.moeda || 'AOA',
        descricao: bruta.descricao || null,
        referencia,
        estado: ESTADOS.POR_CONCILIAR,
      },
    });
    resultado.importadas += 1;

    const desfecho = credito
      ? await tentarConciliar(criada, actor)
      : await marcar(criada.id, ESTADOS.SEM_CORRESPONDENCIA, 'Linha a débito — não é uma entrada de dinheiro.');

    if (desfecho.estado === ESTADOS.CONCILIADA) resultado.conciliadas += 1;
    else resultado.porResolver += 1;
    resultado.detalhes.push({ idNoBanco, estado: desfecho.estado, motivo: desfecho.motivo || null });
  }

  return resultado;
}

async function marcar(id, estado, motivo, invoiceId = null) {
  await prisma.linhaExtrato.update({
    where: { id },
    data: {
      estado,
      motivo,
      invoiceId,
      conciliadaEm: estado === ESTADOS.CONCILIADA ? new Date() : null,
    },
  });
  return { estado, motivo };
}

/**
 * Tenta casar UMA linha com UMA fatura.
 *
 * Três condições, e as três têm de bater. Aceitar duas em três seria transformar
 * este módulo naquilo que ele existe para evitar.
 */
async function tentarConciliar(linha, actor = null) {
  if (!linha.referencia) {
    return marcar(linha.id, ESTADOS.SEM_CORRESPONDENCIA, 'Sem referência reconhecível na descrição.');
  }

  const fatura = await prisma.invoice.findUnique({
    where: { referenciaPagamento: linha.referencia },
    include: { payment: true },
  });

  if (!fatura) {
    return marcar(linha.id, ESTADOS.SEM_CORRESPONDENCIA, `Nenhuma fatura com a referência ${linha.referencia}.`);
  }

  if (fatura.payment) {
    // Não é erro do banco nem da plataforma: é o mesmo pagamento a chegar duas
    // vezes, ou um pagamento a mais. Fica sinalizado para alguém devolver o
    // dinheiro — silenciá-lo seria ficar com ele.
    return marcar(linha.id, ESTADOS.DIVERGENTE, 'A fatura já tem pagamento registado.', fatura.id);
  }

  if (linha.moeda !== fatura.currency) {
    return marcar(linha.id, ESTADOS.DIVERGENTE,
      `Moeda diferente: extrato em ${linha.moeda}, fatura em ${fatura.currency}.`, fatura.id);
  }

  // Comparação ao cêntimo. Uma tolerância "pequena" seria uma decisão de
  // negócio disfarçada de detalhe técnico — quem aceita menos do que devia é
  // sempre o fornecedor, e não é a plataforma que pode decidir isso por ele.
  const esperado = Number(fatura.amount).toFixed(2);
  const recebido = Number(linha.montante).toFixed(2);
  if (esperado !== recebido) {
    return marcar(linha.id, ESTADOS.DIVERGENTE,
      `Valor diferente: esperado ${esperado} ${fatura.currency}, recebido ${recebido}.`, fatura.id);
  }

  // Tudo bate: paga-se, e as duas escritas vivem na mesma transação.
  await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        invoiceId: fatura.id,
        amount: fatura.amount,
        currency: fatura.currency,
        status: 'PROCESSADO',
        canal: 'REFERENCIA_BANCARIA',
        // A conciliação não tem uma pessoa por trás. Guarda-se a linha do
        // extrato como origem, em vez de atribuir a alguém que não decidiu.
        processedById: actor?.id || null,
        reference: `CONC-${linha.idNoBanco}`,
        processedAt: linha.dataValor,
      },
    });
    await tx.invoice.update({ where: { id: fatura.id }, data: { status: 'PAGA' } });
  });

  await auditService.record({
    action: 'PAGAMENTO_CONCILIADO',
    entityType: 'Invoice',
    entityId: fatura.id,
    actorId: actor?.id || null,
    actorName: actor?.name || 'Conciliação automática',
    metadata: { linhaExtrato: linha.idNoBanco, referencia: linha.referencia, montante: recebido },
  }).catch(() => {});

  return marcar(linha.id, ESTADOS.CONCILIADA, null, fatura.id);
}

/**
 * As linhas que ficaram por resolver — o trabalho que sobra para uma pessoa.
 *
 * É esta lista que diz se a conciliação está a valer a pena. Se crescer sempre,
 * o formato da descrição do banco mudou e ninguém deu por isso.
 */
async function porResolver({ page, limit } = {}) {
  const paginacao = require('../utils/paginacao');
  const p = paginacao.parametros({ page, limit });
  const where = { estado: { in: [ESTADOS.SEM_CORRESPONDENCIA, ESTADOS.DIVERGENTE] } };

  const [total, itens] = await Promise.all([
    prisma.linhaExtrato.count({ where }),
    prisma.linhaExtrato.findMany({
      where, orderBy: { dataValor: 'desc' }, skip: p.skip, take: p.take,
      include: { invoice: { select: { id: true, reference: true, amount: true, currency: true } } },
    }),
  ]);
  return paginacao.envelope(itens, total, p);
}

/** Reprocessa uma linha depois de alguém corrigir a referência à mão. */
async function reconciliarManualmente(linhaId, { referencia }, actor) {
  const linha = await prisma.linhaExtrato.findUnique({ where: { id: linhaId } });
  if (!linha) throw new NotFoundError('Linha do extrato');
  if (linha.estado === ESTADOS.CONCILIADA) {
    throw new BusinessRuleError('Esta linha já foi conciliada.');
  }
  const atualizada = await prisma.linhaExtrato.update({
    where: { id: linhaId }, data: { referencia: referencia || linha.referencia },
  });
  return tentarConciliar(atualizada, actor);
}

module.exports = {
  ESTADOS,
  gerarReferencia,
  atribuirReferencia,
  extrairReferencia,
  importarExtrato,
  tentarConciliar,
  porResolver,
  reconciliarManualmente,
};
