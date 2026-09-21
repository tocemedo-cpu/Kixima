// tests/agt-atribuir-document-no.test.js
// agtSeriesService.atribuirDocumentNo() — atribui, UMA ÚNICA VEZ e de forma
// ATÓMICA, o documentNo REAL da AGT ("<tipo> <seriesCode>/<número>") a um
// documento (FT/NC/RC), a partir da série que a AGT concedeu (AgtSeriesFe) —
// nunca a série fiscal interna (Company.serieFiscal/Invoice.numeroNaSerie,
// que é só a cadeia de hash própria do KIXIMA). É por isto que documentos
// criados ANTES de a serieFiscal interna existir também conseguem um
// documentNo real, desde que a série AGT já tenha sido concedida.
const agtSeriesService = require('../src/services/agtSeriesService');
const { prisma } = require('./helpers');

const ANO_ATUAL = new Date().getFullYear();
const OPCOES = { establishmentNumber: '1' };

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.agtSeriesFe.deleteMany({});
});

// Fatura mínima, SEM `serie`/`numeroNaSerie` (nunca declarados) — exatamente
// o estado de um documento cuja empresa fornecedora nunca teve
// Company.serieFiscal configurada.
async function novaFaturaSemSerieInterna() {
  return prisma.invoice.create({
    data: {
      reference: `FAT-TESTE-AGTNUM-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      amount: 100, dueAt: new Date(Date.now() + 7 * 86400000),
    },
  });
}

async function novaSerieFT(seriesCode, overrides = {}) {
  return prisma.agtSeriesFe.create({
    data: {
      ano: ANO_ATUAL, tipoDocumento: 'FT', establishmentNumber: '1', taxRegistrationNumber: '5001636863',
      seriesCode, submissionUUID: `uuid-${seriesCode}`, resultCode: '1', ...overrides,
    },
  });
}

describe('agtSeriesService.atribuirDocumentNo', () => {
  test('atribui "<tipo> <seriesCode>/1" ao primeiro documento, mesmo sem série fiscal interna', async () => {
    await novaSerieFT('FT-NUM-A');
    const invoice = await novaFaturaSemSerieInterna();

    const documentNo = await agtSeriesService.atribuirDocumentNo('FT', invoice.id, OPCOES);
    expect(documentNo).toBe('FT FT-NUM-A/1');

    const gravado = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    expect(gravado.agtDocumentNo).toBe('FT FT-NUM-A/1');
  });

  test('incrementa sucessivamente para documentos seguintes da mesma série', async () => {
    await novaSerieFT('FT-NUM-B');
    const primeira = await novaFaturaSemSerieInterna();
    const segunda = await novaFaturaSemSerieInterna();

    expect(await agtSeriesService.atribuirDocumentNo('FT', primeira.id, OPCOES)).toBe('FT FT-NUM-B/1');
    expect(await agtSeriesService.atribuirDocumentNo('FT', segunda.id, OPCOES)).toBe('FT FT-NUM-B/2');
  });

  test('idempotente: pedidos repetidos do mesmo documento devolvem sempre o mesmo número, sem consumir outro', async () => {
    await novaSerieFT('FT-NUM-C');
    const invoice = await novaFaturaSemSerieInterna();
    const outraFatura = await novaFaturaSemSerieInterna();

    const primeiro = await agtSeriesService.atribuirDocumentNo('FT', invoice.id, OPCOES);
    const repetido = await agtSeriesService.atribuirDocumentNo('FT', invoice.id, OPCOES);
    expect(repetido).toBe(primeiro);

    // A próxima fatura NOVA continua a receber o número seguinte — a
    // repetição acima não avançou o contador da série.
    expect(await agtSeriesService.atribuirDocumentNo('FT', outraFatura.id, OPCOES)).toBe('FT FT-NUM-C/2');
  });

  test('sem nenhuma série concedida pela AGT para o tipo/ano, recusa-se a inventar um documentNo', async () => {
    const invoice = await novaFaturaSemSerieInterna();
    await expect(agtSeriesService.atribuirDocumentNo('FT', invoice.id, OPCOES)).rejects.toThrow(/Não existe nenhuma série/);
  });

  test('tipo não suportado é rejeitado', async () => {
    const invoice = await novaFaturaSemSerieInterna();
    await expect(agtSeriesService.atribuirDocumentNo('XX', invoice.id, OPCOES)).rejects.toThrow(/não suportado/);
  });

  test('NC e RC usam as suas próprias séries/contadores, independentes do FT', async () => {
    await novaSerieFT('FT-NUM-D');
    await prisma.agtSeriesFe.create({
      data: { ano: ANO_ATUAL, tipoDocumento: 'NC', establishmentNumber: '1', taxRegistrationNumber: '5001636863', seriesCode: 'NC-NUM-D', submissionUUID: 'uuid-nc-num-d', resultCode: '1' },
    });

    const invoice = await novaFaturaSemSerieInterna();
    const creditNote = await prisma.creditNote.create({
      data: { reference: `NC-TESTE-AGTNUM-${Date.now()}`, invoiceId: invoice.id, motivo: 'Correção de teste', amount: 10 },
    });

    expect(await agtSeriesService.atribuirDocumentNo('FT', invoice.id, OPCOES)).toBe('FT FT-NUM-D/1');
    expect(await agtSeriesService.atribuirDocumentNo('NC', creditNote.id, OPCOES)).toBe('NC NC-NUM-D/1');
  });
});
