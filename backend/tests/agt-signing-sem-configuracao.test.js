// tests/agt-signing-sem-configuracao.test.js
// Caminho de recusa do agtSigningService/agtPayloadService quando a chave
// privada AGT e/ou o número de validação NÃO estão configurados — o estado
// real desta plataforma hoje (por ligar, ver agtSigningService.js).
//
// Vive à parte de agt-payload.test.js de propósito: a configuração é lida
// UMA VEZ, ao carregar o módulo (CONFIG capturado no primeiro require), por
// isso não há como alternar "configurado"/"não configurado" dentro do mesmo
// ficheiro de teste — este ficheiro nunca define
// AGT_JWS_PRIVATE_KEY_BASE64/AGT_SOFTWARE_VALIDATION_NUMBER, antes de
// nenhum require.
delete process.env.AGT_JWS_PRIVATE_KEY_BASE64;
delete process.env.AGT_SOFTWARE_VALIDATION_NUMBER;

const agtSigningService = require('../src/services/agtSigningService');
const agtPayloadService = require('../src/services/agtPayloadService');
const { prisma } = require('./helpers');

afterAll(async () => {
  await prisma.$disconnect();
});

describe('agtSigningService sem configuração', () => {
  test('emFalta() lista as duas variáveis em falta pelo nome', () => {
    expect(agtSigningService.emFalta().sort()).toEqual(
      ['AGT_JWS_PRIVATE_KEY_BASE64', 'AGT_SOFTWARE_VALIDATION_NUMBER'].sort(),
    );
  });

  test('disponivel() é falso', () => {
    expect(agtSigningService.disponivel()).toBe(false);
  });

  test('exigirConfiguracao() lança com mensagem clara, nunca produz um valor simulado', () => {
    expect(() => agtSigningService.exigirConfiguracao()).toThrow(
      /Assinatura AGT não está configurada.*AGT_JWS_PRIVATE_KEY_BASE64.*AGT_SOFTWARE_VALIDATION_NUMBER/s,
    );
  });

  test('assinarJWS() recusa-se a assinar', () => {
    expect(() => agtSigningService.assinarJWS({ a: 1 })).toThrow(/não está configurada/);
  });

  test('assinarDocumento() recusa-se a assinar', () => {
    expect(() => agtSigningService.assinarDocumento({
      documentNo: 'FT 1', taxRegistrationNumber: 'AO123', documentType: 'FT',
      documentDate: '2026-01-01', customerTaxID: 'AO999', customerCountry: 'AO', companyName: 'Teste',
    })).toThrow(/não está configurada/);
  });

  test('construirSoftwareInfo() recusa-se a assinar', () => {
    expect(() => agtSigningService.construirSoftwareInfo()).toThrow(/não está configurada/);
  });

  test('estado() reporta indisponível, para o painel de Prontidão', () => {
    const estado = agtSigningService.estado();
    expect(estado).toMatchObject({ canal: 'AGT_ASSINATURA', disponivel: false });
    expect(estado.emFalta.length).toBe(2);
  });
});

describe('agtPayloadService.construirPayload sem configuração', () => {
  test('recusa antes de tocar na base de dados — nenhum payload nem assinatura simulada', async () => {
    await expect(agtPayloadService.construirPayload('FT', 'id-qualquer-inexistente', 'empresa-qualquer-inexistente'))
      .rejects.toThrow(/Assinatura AGT não está configurada/);
  });
});
