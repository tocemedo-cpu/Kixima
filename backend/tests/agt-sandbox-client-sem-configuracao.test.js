// tests/agt-sandbox-client-sem-configuracao.test.js
// Caminho de recusa do agtSandboxClient quando a chave privada AGT e/ou as
// credenciais da Sandbox NÃO estão configuradas — o estado real desta
// plataforma hoje (por ligar, ver agtSandboxClient.js). Mesmo molde de
// agt-signing-sem-configuracao.test.js.
const agtSandboxClient = require('../src/services/agtSandboxClient');

describe('agtSandboxClient sem configuração', () => {
  test('emFalta() lista as quatro variáveis em falta pelo nome', () => {
    // AGT_SANDBOX_BASE_URL deixou de fazer parte desta lista: o URL de cada
    // endpoint já não vem de uma única base configurável, vem de
    // config/agt.js (hml/prd, resolvido por AGT_ENV) — uma só fonte para o
    // URL, à parte das credenciais.
    expect(agtSandboxClient.emFalta().sort()).toEqual(
      [
        'AGT_JWS_PRIVATE_KEY_BASE64 (ou src/chave/chavePrivada.pem)',
        'AGT_SOFTWARE_VALIDATION_NUMBER',
        'AGT_SANDBOX_USERNAME',
        'AGT_SANDBOX_PASSWORD',
      ].sort(),
    );
  });

  test('disponivel() é falso', () => {
    expect(agtSandboxClient.disponivel()).toBe(false);
  });

  test('exigirConfiguracao() lança com mensagem clara, nunca produz uma resposta simulada', () => {
    expect(() => agtSandboxClient.exigirConfiguracao()).toThrow(
      /Ligação à Sandbox da AGT não está configurada.*AGT_SANDBOX_USERNAME/s,
    );
  });

  test('assinarJWS() recusa-se a assinar', () => {
    expect(() => agtSandboxClient.assinarJWS('texto qualquer')).toThrow(/não está configurada/);
  });

  test('assinarSoftware() recusa-se a assinar', () => {
    expect(() => agtSandboxClient.assinarSoftware()).toThrow(/não está configurada/);
  });

  test('assinarDocumento() recusa-se a assinar', () => {
    expect(() => agtSandboxClient.assinarDocumento({
      documentNo: 'FT 1', taxRegistrationNumber: 'AO123', documentType: 'FT',
      documentDate: '2026-01-01', customerTaxID: 'AO999', customerCountry: 'AO', companyName: 'Teste', documentTotals: {},
    })).toThrow(/não está configurada/);
  });

  test('assinarSolicitacao() recusa-se a assinar', () => {
    expect(() => agtSandboxClient.assinarSolicitacao({ taxRegistrationNumber: 'AO123', submissionUUID: 'abc' }))
      .toThrow(/não está configurada/);
  });

  test('registarFactura()/solicitarSerie()/obterEstado()/consultarFactura()/listarFacturas() recusam-se a chamar a rede', async () => {
    await expect(agtSandboxClient.registarFactura({})).rejects.toThrow(/não está configurada/);
    await expect(agtSandboxClient.solicitarSerie({})).rejects.toThrow(/não está configurada/);
    await expect(agtSandboxClient.obterEstado({})).rejects.toThrow(/não está configurada/);
    await expect(agtSandboxClient.consultarFactura({})).rejects.toThrow(/não está configurada/);
    await expect(agtSandboxClient.listarFacturas({})).rejects.toThrow(/não está configurada/);
  });

  test('estado() reporta indisponível, para o painel de Prontidão', () => {
    const estado = agtSandboxClient.estado();
    expect(estado).toMatchObject({ canal: 'AGT_SANDBOX', disponivel: false });
    expect(estado.emFalta.length).toBe(4);
  });
});
