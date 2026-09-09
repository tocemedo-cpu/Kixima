// tests/agt-series.test.js
// agtSeriesService.js gera o pedido "Solicitar Série" (spec DS.120, 4.5) —
// pré-requisito documentado para poder usar uma série própria num
// documentNo. Chave de teste injetada tal como nos outros ficheiros de
// teste de AGT.
const crypto = require('crypto');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
process.env.AGT_JWS_PRIVATE_KEY_BASE64 = Buffer.from(privateKey).toString('base64');
process.env.AGT_SOFTWARE_VALIDATION_NUMBER = 'FE/00/2025/AGT-TESTE';

const agtSeriesService = require('../src/services/agtSeriesService');

function base64urlParaBuffer(s) {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}
function verificarJWS(jws) {
  const [h, p, s] = jws.split('.');
  const ok = crypto.verify('RSA-SHA256', Buffer.from(`${h}.${p}`, 'utf8'), publicKey, base64urlParaBuffer(s));
  return { ok, payload: JSON.parse(base64urlParaBuffer(p).toString('utf8')) };
}

describe('construirPedidoSerie', () => {
  test('produz o pedido com os campos documentados, jwsSignature verificável, seriesContingencyIndicator "N" por omissão', () => {
    const pedido = agtSeriesService.construirPedidoSerie({
      taxRegistrationNumber: '5001636863', seriesYear: '2026', documentType: 'FR', establishmentNumber: '1',
    });
    expect(pedido.schemaVersion).toBe('1.2');
    expect(pedido.submissionUUID).toMatch(/^[0-9a-f-]{36}$/);
    expect(pedido.taxRegistrationNumber).toBe('5001636863');
    expect(pedido.seriesYear).toBe('2026');
    expect(pedido.documentType).toBe('FR');
    expect(pedido.establishmentNumber).toBe('1');
    expect(pedido.seriesContingencyIndicator).toBe('N');

    const { ok, payload } = verificarJWS(pedido.jwsSignature);
    expect(ok).toBe(true);
    expect(payload).toEqual({
      taxRegistrationNumber: '5001636863', seriesYear: '2026', documentType: 'FR',
      establishmentNumber: '1', seriesContingencyIndicator: 'N',
    });
  });

  test('softwareInfo tem uma jwsSoftwareSignature verificável (mesma assinatura do resto do sistema)', () => {
    const pedido = agtSeriesService.construirPedidoSerie({
      taxRegistrationNumber: '5001636863', seriesYear: '2026', documentType: 'NC', establishmentNumber: '1',
    });
    const { ok } = verificarJWS(pedido.softwareInfo.jwsSoftwareSignature);
    expect(ok).toBe(true);
  });

  test('sem configuração (chave/número de validação), recusa-se a assinar', () => {
    jest.isolateModules(() => {
      delete process.env.AGT_JWS_PRIVATE_KEY_BASE64;
      delete process.env.AGT_SOFTWARE_VALIDATION_NUMBER;
      const semConfig = require('../src/services/agtSeriesService');
      expect(() => semConfig.construirPedidoSerie({ taxRegistrationNumber: 'x', seriesYear: '2026', documentType: 'FR', establishmentNumber: '1' }))
        .toThrow(/não está configurada/);
      process.env.AGT_JWS_PRIVATE_KEY_BASE64 = Buffer.from(privateKey).toString('base64');
      process.env.AGT_SOFTWARE_VALIDATION_NUMBER = 'FE/00/2025/AGT-TESTE';
    });
  });
});
