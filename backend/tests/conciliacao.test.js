// tests/conciliacao.test.js
// Referência bancária e conciliação automática (KX-05).
//
// A regra que governa este módulo inteiro: NA DÚVIDA, NÃO SE DÁ POR PAGA. Uma
// fatura marcada como paga por engano é dinheiro que o fornecedor espera e não
// vem — e a plataforma passou a mentir sobre a única coisa que promete.
//
// Por isso a maior parte destes testes não verifica que a conciliação funciona.
// Verifica que ela se RECUSA a funcionar quando alguma coisa não bate certo. É
// o comportamento difícil: o caminho feliz escreve-se sozinho, e todos os
// caminhos infelizes têm de acabar no mesmo sítio — à espera de uma pessoa,
// que é onde tudo estava antes deste módulo existir.

const { prisma } = require('./helpers');
const conciliacao = require('../src/services/conciliacaoService');
const multicaixa = require('../src/services/multicaixaService');

let fatura;
let contador = 0;

async function novaFatura(amount = 1000, currency = 'AOA') {
  contador += 1;
  const criada = await prisma.invoice.create({
    data: {
      reference: `FAT-CONC-${Date.now()}-${contador}`,
      amount, netAmount: amount, taxAmount: 0, currency,
      dueAt: new Date(Date.now() + 7 * 86400000),
      status: 'PENDENTE',
    },
  });
  await conciliacao.atribuirReferencia(criada.id);
  return prisma.invoice.findUnique({ where: { id: criada.id } });
}

const linha = (over = {}) => ({
  idNoBanco: `BK-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  dataValor: new Date().toISOString(),
  montante: 1000,
  moeda: 'AOA',
  descricao: 'TRANSFERENCIA',
  ...over,
});

afterEach(async () => {
  await prisma.linhaExtrato.deleteMany({ where: { idNoBanco: { startsWith: 'BK-' } } });
  await prisma.payment.deleteMany({ where: { reference: { startsWith: 'CONC-BK-' } } });
  await prisma.invoice.deleteMany({ where: { reference: { startsWith: 'FAT-CONC-' } } });
});
afterAll(async () => { await prisma.$disconnect(); });

describe('A referência que o pagador escreve', () => {
  test('não usa caracteres que se trocam entre si', () => {
    // O, I, 0 e 1 lidos em voz alta ao balcão produzem uma transferência que
    // chega ao banco e não casa com fatura nenhuma: o dinheiro entrou, o
    // comprador jura que pagou, e ninguém consegue explicar porquê.
    for (let i = 0; i < 200; i += 1) {
      const r = conciliacao.gerarReferencia().replace('KX', '').replace('-', '');
      expect(r).not.toMatch(/[OI01]/);
    }
  });

  test('é única por fatura', async () => {
    const a = await novaFatura();
    const b = await novaFatura();
    expect(a.referenciaPagamento).toBeTruthy();
    expect(a.referenciaPagamento).not.toBe(b.referenciaPagamento);
  });

  test('é reconhecida mesmo escrita como as pessoas escrevem', () => {
    const ref = 'KXABCD-EFGH';
    // O banco devolve a descrição tal como o pagador a escreveu. Aceitar só o
    // formato exato faria falhar a maioria das transferências reais — e cada
    // falha dessas é trabalho manual que este módulo existe para eliminar.
    for (const variante of [
      'KXABCD-EFGH', 'kxabcd-efgh', 'KXABCDEFGH', 'kx abcd efgh',
      'PAGAMENTO KXABCD-EFGH FATURA', 'TRF  KXABCD/EFGH  ',
    ]) {
      expect(conciliacao.extrairReferencia(variante)).toBe(ref);
    }
  });

  test('descrição sem referência não inventa nenhuma', () => {
    for (const nada of ['TRANSFERENCIA', '', null, 'PAGAMENTO 12345', undefined]) {
      expect(conciliacao.extrairReferencia(nada)).toBeNull();
    }
  });
});

describe('Concilia quando tudo bate', () => {
  test('referência e valor certos dão a fatura por paga', async () => {
    fatura = await novaFatura(1000);
    const r = await conciliacao.importarExtrato([
      linha({ montante: 1000, descricao: `PAGAMENTO ${fatura.referenciaPagamento}` }),
    ]);

    expect(r.conciliadas).toBe(1);
    const depois = await prisma.invoice.findUnique({
      where: { id: fatura.id }, include: { payment: true },
    });
    expect(depois.status).toBe('PAGA');
    expect(depois.payment.canal).toBe('REFERENCIA_BANCARIA');
    // Ninguém executou este pagamento: foi o extrato que bateu certo. Um
    // utilizador "sistema" daria a estes pagamentos o mesmo aspeto dos que uma
    // pessoa decidiu.
    expect(depois.payment.processedById).toBeNull();
  });
});

describe('Recusa-se quando alguma coisa não bate', () => {
  test('valor a menos NÃO paga', async () => {
    fatura = await novaFatura(1000);
    const r = await conciliacao.importarExtrato([
      linha({ montante: 999.99, descricao: fatura.referenciaPagamento }),
    ]);
    expect(r.conciliadas).toBe(0);
    expect(r.detalhes[0].estado).toBe(conciliacao.ESTADOS.DIVERGENTE);

    const depois = await prisma.invoice.findUnique({ where: { id: fatura.id }, include: { payment: true } });
    expect(depois.status).toBe('PENDENTE');
    expect(depois.payment).toBeNull();
  });

  test('valor a mais também NÃO paga', async () => {
    // Tolerar "um bocadinho a mais" seria uma decisão de negócio disfarçada de
    // detalhe técnico. Quem aceita menos do que devia é sempre o fornecedor.
    fatura = await novaFatura(1000);
    const r = await conciliacao.importarExtrato([
      linha({ montante: 1500, descricao: fatura.referenciaPagamento }),
    ]);
    expect(r.conciliadas).toBe(0);
    expect(r.detalhes[0].estado).toBe(conciliacao.ESTADOS.DIVERGENTE);
  });

  test('moeda diferente NÃO é convertida em silêncio', async () => {
    fatura = await novaFatura(1000, 'AOA');
    const r = await conciliacao.importarExtrato([
      linha({ montante: 1000, moeda: 'USD', descricao: fatura.referenciaPagamento }),
    ]);
    expect(r.conciliadas).toBe(0);
    expect(r.detalhes[0].motivo).toMatch(/Moeda/);
  });

  test('um débito com referência na descrição NÃO paga nada', async () => {
    // Dar por paga uma fatura com o dinheiro a SAIR é o pior erro possível.
    fatura = await novaFatura(1000);
    const r = await conciliacao.importarExtrato([
      linha({ montante: -1000, descricao: fatura.referenciaPagamento }),
    ]);
    expect(r.conciliadas).toBe(0);
    const depois = await prisma.invoice.findUnique({ where: { id: fatura.id } });
    expect(depois.status).toBe('PENDENTE');
  });

  test('referência que não existe fica a aguardar pessoa', async () => {
    const r = await conciliacao.importarExtrato([
      linha({ descricao: 'KXZZZZ-ZZZZ' }),
    ]);
    expect(r.detalhes[0].estado).toBe(conciliacao.ESTADOS.SEM_CORRESPONDENCIA);
    expect(r.porResolver).toBe(1);
  });

  test('a linha fica GUARDADA mesmo quando não casa', async () => {
    // "Não encontrámos nada" e "entrou mas não casou" são respostas diferentes
    // à pergunta "o dinheiro entrou?". A segunda tem de ter uma linha.
    const l = linha({ descricao: 'SEM REFERENCIA NENHUMA' });
    await conciliacao.importarExtrato([l]);
    const guardada = await prisma.linhaExtrato.findUnique({ where: { idNoBanco: l.idNoBanco } });
    expect(guardada).toBeTruthy();
    expect(guardada.estado).toBe(conciliacao.ESTADOS.SEM_CORRESPONDENCIA);
  });
});

describe('Importar o mesmo extrato duas vezes', () => {
  test('não paga a fatura duas vezes', async () => {
    // O banco reenvia extratos e as pessoas carregam o mesmo ficheiro duas
    // vezes. É banal, não excecional — e sem idempotência seria um pagamento
    // duplicado por cada repetição.
    fatura = await novaFatura(1000);
    const l = linha({ montante: 1000, descricao: fatura.referenciaPagamento });

    const primeira = await conciliacao.importarExtrato([l]);
    const segunda = await conciliacao.importarExtrato([l]);

    expect(primeira.conciliadas).toBe(1);
    expect(segunda.importadas).toBe(0);
    expect(segunda.repetidas).toBe(1);

    const pagamentos = await prisma.payment.count({ where: { invoiceId: fatura.id } });
    expect(pagamentos).toBe(1);
  });

  test('um segundo pagamento com a MESMA referência é sinalizado, não engolido', async () => {
    fatura = await novaFatura(1000);
    await conciliacao.importarExtrato([linha({ montante: 1000, descricao: fatura.referenciaPagamento })]);
    const r = await conciliacao.importarExtrato([linha({ montante: 1000, descricao: fatura.referenciaPagamento })]);

    // Alguém pagou duas vezes. Silenciar isto seria ficar com o dinheiro.
    expect(r.detalhes[0].estado).toBe(conciliacao.ESTADOS.DIVERGENTE);
    expect(r.detalhes[0].motivo).toMatch(/já tem pagamento/);
  });
});

describe('O que sobra para uma pessoa', () => {
  test('as linhas por resolver são listadas com a fatura, quando há', async () => {
    fatura = await novaFatura(1000);
    await conciliacao.importarExtrato([linha({ montante: 500, descricao: fatura.referenciaPagamento })]);

    const lista = await conciliacao.porResolver({ limit: 50 });
    expect(lista.total).toBeGreaterThan(0);
    const nossa = lista.itens.find((i) => i.invoiceId === fatura.id);
    expect(nossa.estado).toBe(conciliacao.ESTADOS.DIVERGENTE);
  });

  test('corrigir a referência à mão volta a tentar', async () => {
    fatura = await novaFatura(1000);
    const l = linha({ montante: 1000, descricao: 'REFERENCIA ILEGIVEL' });
    await conciliacao.importarExtrato([l]);

    const guardada = await prisma.linhaExtrato.findUnique({ where: { idNoBanco: l.idNoBanco } });
    const r = await conciliacao.reconciliarManualmente(guardada.id, {
      referencia: fatura.referenciaPagamento,
    }, { id: null, name: 'Financeiro' });

    expect(r.estado).toBe(conciliacao.ESTADOS.CONCILIADA);
    const depois = await prisma.invoice.findUnique({ where: { id: fatura.id } });
    expect(depois.status).toBe('PAGA');
  });
});

describe('Multicaixa Express', () => {
  test('sem credenciais, RECUSA-SE em vez de fingir', async () => {
    // Um canal de pagamento que responde "pago" sem falar com o banco é a pior
    // avaria possível — e um modo de simulação acaba sempre por ser ligado em
    // produção por engano.
    expect(multicaixa.disponivel()).toBe(false);
    await expect(multicaixa.pedirPagamento({ referencia: 'FAT-TESTE', valor: 1, moeda: 'AOA', telemovel: '900000000' }))
      .rejects.toThrow(/não está configurado/i);
  });

  test('diz o que falta, em vez de falhar sem explicação', () => {
    const e = multicaixa.estado();
    expect(e.disponivel).toBe(false);
    expect(e.emFalta.length).toBeGreaterThan(0);
    expect(e.nota).toMatch(/por ligar/i);
  });
});
