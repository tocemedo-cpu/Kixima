// tests/faturacao-agt.test.js
// Base técnica de faturação certificada (KX-01).
//
// O que estes testes protegem não é uma funcionalidade — é uma propriedade que
// não se corrige para trás. Uma numeração com um buraco, ou uma cadeia de hash
// partida, descobre-se numa inspeção da AGT, e nessa altura não há como emendar:
// as faturas já foram emitidas e entregues.
//
// A parte difícil não é gerar números sequenciais. É garantir que um número
// NÃO É CONSUMIDO quando a transação que o pediu falha. Um contador comum
// (INSERT … ON CONFLICT DO UPDATE, como o `reference_counters` desta mesma
// aplicação) incrementa numa instrução independente e deixa buraco. É por isso
// que a série usa SELECT … FOR UPDATE dentro da transação da fatura, e é isso
// que o teste do rollback mede.

const { prisma } = require('./helpers');
const config = require('../src/config/env');
const faturacao = require('../src/services/faturacaoService');
const saft = require('../src/services/saftService');

const SERIE = 'TESTE';
let serieOriginal;

beforeAll(() => {
  serieOriginal = config.faturacao.serie;
  config.faturacao.serie = SERIE;
});

afterAll(async () => {
  config.faturacao.serie = serieOriginal;
  await prisma.invoice.deleteMany({ where: { serie: SERIE } });
  await prisma.$executeRaw`DELETE FROM "series_faturacao" WHERE "codigo" = ${SERIE}`;
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.invoice.deleteMany({ where: { serie: SERIE } });
  await prisma.$executeRaw`DELETE FROM "series_faturacao" WHERE "codigo" = ${SERIE}`;
});

// Cria uma fatura mínima com numeração certificada, na mesma transação.
async function emitir(total = 1000, { rebentar = false } = {}) {
  return prisma.$transaction(async (tx) => {
    const certificacao = await faturacao.atribuir(tx, { emitidaEm: new Date(), total });
    const criada = await tx.invoice.create({
      data: {
        ...certificacao,
        reference: `FAT-TESTE-${certificacao.numeroNaSerie}-${Math.random().toString(36).slice(2, 8)}`,
        amount: total,
        netAmount: total,
        taxAmount: 0,
        currency: 'AOA',
        dueAt: new Date(Date.now() + 7 * 86400000),
        status: 'PENDENTE',
      },
    });
    if (rebentar) throw new Error('falha depois de atribuir o número');
    return criada;
  });
}

describe('Numeração da série', () => {
  test('começa no 1 e não salta', async () => {
    const a = await emitir();
    const b = await emitir();
    const c = await emitir();
    expect([a.numeroNaSerie, b.numeroNaSerie, c.numeroNaSerie]).toEqual([1, 2, 3]);
    expect(a.serie).toBe(SERIE);
  });

  test('uma transação que falha NÃO consome o número', async () => {
    // É este o teste que justifica o desenho todo. Com um contador
    // independente, a emissão seguinte receberia o 3 e o 2 ficaria por
    // explicar — e "onde está a fatura 2?" é a pergunta que não tem resposta
    // boa numa inspeção.
    await emitir();
    await expect(emitir(500, { rebentar: true })).rejects.toThrow(/falha depois/);

    const seguinte = await emitir();
    expect(seguinte.numeroNaSerie).toBe(2);
  });

  test('emissões simultâneas não recebem o mesmo número', async () => {
    const resultados = await Promise.all([emitir(100), emitir(200), emitir(300), emitir(400)]);
    const numeros = resultados.map((r) => r.numeroNaSerie).sort((x, y) => x - y);
    expect(numeros).toEqual([1, 2, 3, 4]);
  });

  test('a base recusa dois documentos com o mesmo número na série', async () => {
    const primeira = await emitir();
    await expect(prisma.invoice.create({
      data: {
        serie: SERIE,
        numeroNaSerie: primeira.numeroNaSerie,
        reference: 'FAT-DUPLICADA',
        amount: 1, netAmount: 1, taxAmount: 0, currency: 'AOA',
        dueAt: new Date(), status: 'PENDENTE',
      },
    })).rejects.toThrow();
  });
});

describe('Cadeia de integridade', () => {
  test('cada documento agarra-se ao anterior', async () => {
    const a = await emitir(1000);
    const b = await emitir(2000);

    expect(a.hashAnterior).toBeNull();
    expect(a.hashDocumento).toEqual(expect.any(String));
    expect(b.hashAnterior).toBe(a.hashDocumento);
    expect(b.hashDocumento).not.toBe(a.hashDocumento);
  });

  test('a verificação diz que está íntegra quando está', async () => {
    await emitir(1000);
    await emitir(2000);
    const r = await faturacao.verificarCadeia(SERIE);
    expect(r.documentos).toBe(2);
    expect(r.integra).toBe(true);
    expect(r.problemas).toEqual([]);
  });

  test('alterar o valor de uma fatura emitida é DETETADO', async () => {
    const a = await emitir(1000);
    await emitir(2000);

    // Alteração feita por baixo do serviço, como faria quem quisesse esconder
    // alguma coisa. O hash deixa de bater com o conteúdo.
    await prisma.invoice.update({ where: { id: a.id }, data: { amount: 999999 } });

    const r = await faturacao.verificarCadeia(SERIE);
    expect(r.integra).toBe(false);
    expect(r.problemas.map((p) => p.tipo)).toContain('DOCUMENTO_ALTERADO');
  });

  test('apagar uma fatura do meio parte a numeração E a cadeia', async () => {
    await emitir(1000);
    const meio = await emitir(2000);
    await emitir(3000);

    await prisma.invoice.delete({ where: { id: meio.id } });

    const r = await faturacao.verificarCadeia(SERIE);
    expect(r.integra).toBe(false);
    const tipos = r.problemas.map((p) => p.tipo);
    expect(tipos).toContain('BURACO_NA_NUMERACAO');
    expect(tipos).toContain('ELO_PARTIDO');
  });

  test('a verificação relata TODOS os problemas, não só o primeiro', async () => {
    const a = await emitir(1000);
    const b = await emitir(2000);
    await prisma.invoice.update({ where: { id: a.id }, data: { amount: 111 } });
    await prisma.invoice.update({ where: { id: b.id }, data: { amount: 222 } });

    const r = await faturacao.verificarCadeia(SERIE);
    // Parar no primeiro obrigaria a corrigir e repetir N vezes para ver N
    // problemas — num relatório de integridade isso é inútil.
    expect(r.problemas.filter((p) => p.tipo === 'DOCUMENTO_ALTERADO').length).toBe(2);
  });
});

describe('Desligada, nada muda', () => {
  test('sem série configurada, a fatura sai como sempre saiu', async () => {
    config.faturacao.serie = '';
    try {
      const semSerie = await emitir(1234);
      expect(semSerie.serie).toBeNull();
      expect(semSerie.numeroNaSerie).toBeNull();
      expect(semSerie.hashDocumento).toBeNull();
      await prisma.invoice.delete({ where: { id: semSerie.id } });
    } finally {
      config.faturacao.serie = SERIE;
    }
  });
});

describe('SAF-T (AO)', () => {
  test('exige um período, e recusa datas invertidas', async () => {
    await expect(saft.gerar({ de: 'ontem', ate: 'hoje' })).rejects.toThrow(/AAAA-MM-DD/);
    await expect(saft.gerar({ de: '2030-01-01', ate: '2020-01-01' })).rejects.toThrow(/posterior/);
  });

  test('produz XML bem formado com o cabeçalho e os totais', async () => {
    await emitir(1000);
    await emitir(2000);

    const { xml, resumo } = await saft.gerar({ de: '2020-01-01', ate: '2035-12-31' });
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<AuditFile');
    expect(xml).toContain('</AuditFile>');
    expect(xml).toContain('<SalesInvoices>');
    // Cada abertura tem o seu fecho — o erro mais banal a construir XML à mão.
    for (const tag of ['Header', 'MasterFiles', 'SourceDocuments', 'SalesInvoices']) {
      expect((xml.match(new RegExp(`<${tag}>`, 'g')) || []).length)
        .toBe((xml.match(new RegExp(`</${tag}>`, 'g')) || []).length);
    }
    expect(resumo.documentos).toBeGreaterThanOrEqual(2);
  });

  test('escapa caracteres que partiriam o XML', async () => {
    // Um nome de empresa com "&" é comum, e produz um ficheiro que a AGT
    // recusa sem dizer porquê.
    const empresa = await prisma.company.findFirst({ where: { type: 'CLIENTE' } });
    const nomeOriginal = empresa.name;
    await prisma.company.update({ where: { id: empresa.id }, data: { name: 'Sonangol & Filhos <Lda>' } });
    try {
      const { xml } = await saft.gerar({ de: '2020-01-01', ate: '2035-12-31' });
      expect(xml).not.toContain('Sonangol & Filhos <Lda>');
      if (xml.includes('Sonangol')) {
        expect(xml).toContain('Sonangol &amp; Filhos &lt;Lda&gt;');
      }
    } finally {
      await prisma.company.update({ where: { id: empresa.id }, data: { name: nomeOriginal } });
    }
  });

  test('diz o que ficou por configurar em vez de inventar', async () => {
    const { resumo } = await saft.gerar({ de: '2020-01-01', ate: '2035-12-31' });
    // Um número de certificado inventado num ficheiro fiscal é pior do que um
    // campo por preencher: o primeiro é uma declaração falsa.
    expect(resumo.porConfigurar).toContain('KIXIMA_CERTIFICADO_AGT');
    expect(typeof resumo.semSerieCertificada).toBe('number');
  });
});
