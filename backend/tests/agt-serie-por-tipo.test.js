// tests/agt-serie-por-tipo.test.js
// agtSeriesService.obterSeriePorTipo() — uso INTERNO (sem rota HTTP própria):
// devolve a série ATUALMENTE atribuída pela AGT para um tipo de documento,
// consultando o histórico já gravado em agtSeriesFe (nunca gera nem submete
// nada). Pensado para ser chamado no momento de emitir um documento — ex.:
// ao processar o pagamento de uma fatura e gerar o RC — para saber que
// seriesCode entra no documentNo, nunca uma série fictícia inventada no
// código (ver o comentário no topo de agtSeriesService.js sobre "CERT-FR").
const agtSeriesService = require('../src/services/agtSeriesService');
const { prisma } = require('./helpers');

const ANO_ATUAL = new Date().getFullYear();

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.agtSeriesFe.deleteMany({});
});

describe('agtSeriesService.obterSeriePorTipo', () => {
  test('devolve a série mais recente para o tipo/ano/estabelecimento pedidos', async () => {
    await prisma.agtSeriesFe.create({
      data: {
        ano: ANO_ATUAL, tipoDocumento: 'FT', establishmentNumber: '1', taxRegistrationNumber: '5001636863',
        seriesCode: 'FT-ANTIGA', submissionUUID: 'uuid-ft-antiga', resultCode: '1',
      },
    });
    // createdAt tem default now() — força uma diferença de tempo determinística
    // em vez de confiar em dois `new Date()` consecutivos poderem colidir.
    await new Promise((r) => { setTimeout(r, 10); });
    await prisma.agtSeriesFe.create({
      data: {
        ano: ANO_ATUAL, tipoDocumento: 'FT', establishmentNumber: '1', taxRegistrationNumber: '5001636863',
        seriesCode: 'FT-RECENTE', submissionUUID: 'uuid-ft-recente', resultCode: '1',
      },
    });
    // Outro tipo, não deve interferir na consulta por "FT".
    await prisma.agtSeriesFe.create({
      data: {
        ano: ANO_ATUAL, tipoDocumento: 'NC', establishmentNumber: '1', taxRegistrationNumber: '5001636863',
        seriesCode: 'NC-QUALQUER', submissionUUID: 'uuid-nc', resultCode: '1',
      },
    });

    const serie = await agtSeriesService.obterSeriePorTipo('FT', { establishmentNumber: '1' });
    expect(serie?.seriesCode).toBe('FT-RECENTE');
  });

  test('tipo em minúsculas é normalizado para maiúsculas', async () => {
    await prisma.agtSeriesFe.create({
      data: {
        ano: ANO_ATUAL, tipoDocumento: 'NC', establishmentNumber: '1', taxRegistrationNumber: '5001636863',
        seriesCode: 'NC-2026-01', submissionUUID: 'uuid-nc-minusculo', resultCode: '1',
      },
    });

    const serie = await agtSeriesService.obterSeriePorTipo('nc', { establishmentNumber: '1' });
    expect(serie?.seriesCode).toBe('NC-2026-01');
  });

  test('ano por omissão é o ano em curso — um pedido de outro ano não conta', async () => {
    await prisma.agtSeriesFe.create({
      data: {
        ano: ANO_ATUAL - 1, tipoDocumento: 'FT', establishmentNumber: '1', taxRegistrationNumber: '5001636863',
        seriesCode: 'FT-ANO-PASSADO', submissionUUID: 'uuid-ano-passado', resultCode: '1',
      },
    });

    const serie = await agtSeriesService.obterSeriePorTipo('FT', { establishmentNumber: '1' });
    expect(serie).toBeNull();
  });

  test('sem nenhum pedido aceite para o tipo, devolve null (nunca uma série inventada)', async () => {
    const serie = await agtSeriesService.obterSeriePorTipo('RC', { establishmentNumber: '1' });
    expect(serie).toBeNull();
  });

  test('sem documentType, lança erro em vez de devolver silenciosamente null', async () => {
    await expect(agtSeriesService.obterSeriePorTipo('')).rejects.toThrow(/documentType/);
  });
});
