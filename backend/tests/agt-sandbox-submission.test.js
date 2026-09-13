// tests/agt-sandbox-submission.test.js
// N10 da auditoria de arquitetura: agtSandboxClient.js (cliente REST, já
// testado) nunca era chamado por nenhuma rota/serviço — uma "capacidade
// morta". agtSandboxSubmissionService.js liga-o à emissão real de faturas/
// notas de crédito/recibos. Testado aqui em isolamento (mocks das três
// dependências), mesmo molde do sync.service.spec.ts desta sessão: o
// interessante não é repetir a lógica de agtPayloadService/agtSandboxClient
// (já coberta nos respetivos testes), é confirmar que agtSandboxSubmissionService
// (a) não faz nada sem configuração, (b) monta o documento com os campos
// certos quando configurado, e (c) NUNCA deixa uma falha propagar.
const agtSandboxClient = require('../src/services/agtSandboxClient');
const agtPayloadService = require('../src/services/agtPayloadService');
const auditService = require('../src/services/auditService');

jest.mock('../src/services/agtSandboxClient');
jest.mock('../src/services/agtPayloadService');
jest.mock('../src/services/auditService');

const agtSandboxSubmissionService = require('../src/services/agtSandboxSubmissionService');

const ENVELOPE_FT = {
  taxRegistrationNumber: 'AO123456789',
  documents: [{
    documentNo: 'FT KIA/2026 1',
    documentType: 'FT',
    documentDate: '2026-09-13',
    customerTaxID: '999999999',
    customerCountry: 'AO',
    companyName: 'Kianda Lda',
    documentTotals: { taxPayable: 140, netTotal: 1000, grossTotal: 1140 },
  }],
};

beforeEach(() => {
  jest.clearAllMocks();
  auditService.recordSafe.mockResolvedValue(undefined);
});

describe('agtSandboxSubmissionService.submeter — sem Sandbox configurada', () => {
  test('não faz nada: nem monta payload, nem chama a AGT, nem grava auditoria', async () => {
    agtSandboxClient.disponivel.mockReturnValue(false);

    await agtSandboxSubmissionService.submeter('FT', 'inv-1', 'company-1');

    expect(agtPayloadService.construirPayload).not.toHaveBeenCalled();
    expect(agtSandboxClient.registarFactura).not.toHaveBeenCalled();
    expect(auditService.recordSafe).not.toHaveBeenCalled();
  });
});

describe('agtSandboxSubmissionService.submeter — Sandbox configurada', () => {
  beforeEach(() => {
    agtSandboxClient.disponivel.mockReturnValue(true);
    agtPayloadService.construirPayload.mockResolvedValue(ENVELOPE_FT);
    agtSandboxClient.assinarSoftware.mockReturnValue({
      softwareInfoDetail: { productId: 'KIXIMA', productVersion: '1.0', softwareValidationNumber: '999' },
      jwsSoftwareSignature: 'jws.software.sig',
    });
    agtSandboxClient.assinarDocumento.mockReturnValue('jws.document.sig');
    agtSandboxClient.assinarSolicitacao.mockReturnValue('jws.solicitacao.sig');
    agtSandboxClient.registarFactura.mockResolvedValue({ resultCode: '0', submissionUUID: 'uuid-1' });
  });

  test('reaproveita construirPayload e submete um documento com os 8 campos certos + as 3 assinaturas', async () => {
    await agtSandboxSubmissionService.submeter('FT', 'inv-1', 'company-1');

    expect(agtPayloadService.construirPayload).toHaveBeenCalledWith('FT', 'inv-1', 'company-1');

    const doc = ENVELOPE_FT.documents[0];
    expect(agtSandboxClient.assinarDocumento).toHaveBeenCalledWith({
      documentNo: doc.documentNo,
      taxRegistrationNumber: ENVELOPE_FT.taxRegistrationNumber,
      documentType: doc.documentType,
      documentDate: doc.documentDate,
      customerTaxID: doc.customerTaxID,
      customerCountry: doc.customerCountry,
      companyName: doc.companyName,
      documentTotals: doc.documentTotals,
    });

    const documentoEnviado = agtSandboxClient.registarFactura.mock.calls[0][0];
    expect(documentoEnviado).toMatchObject({
      documentNo: doc.documentNo,
      documentType: doc.documentType,
      documentDate: doc.documentDate,
      taxRegistrationNumber: ENVELOPE_FT.taxRegistrationNumber,
      customerTaxID: doc.customerTaxID,
      customerCountry: doc.customerCountry,
      companyName: doc.companyName,
      documentTotals: doc.documentTotals,
      jwsSoftwareSignature: 'jws.software.sig',
      jwsDocumentSignature: 'jws.document.sig',
      jwsSignature: 'jws.solicitacao.sig',
    });
    expect(typeof documentoEnviado.submissionUUID).toBe('string');
    expect(documentoEnviado.submissionUUID.length).toBeGreaterThan(0);
  });

  test('regista sucesso em auditoria (AGT_SANDBOX_SUBMETIDO) com o entityType certo por tipo de documento', async () => {
    await agtSandboxSubmissionService.submeter('NC', 'nc-1', 'company-1');

    expect(auditService.recordSafe).toHaveBeenCalledWith(expect.objectContaining({
      action: 'AGT_SANDBOX_SUBMETIDO',
      entityType: 'CreditNote',
      entityId: 'nc-1',
    }));
  });

  test('uma falha da AGT (AgtApiError) é apanhada, registada como AGT_SANDBOX_FALHOU, e NUNCA propaga', async () => {
    agtSandboxClient.registarFactura.mockRejectedValue(
      new agtSandboxClient.AgtApiError('registarFactura', '1', [{ message: 'NIF inválido' }]),
    );

    await expect(agtSandboxSubmissionService.submeter('RC', 'pay-1', 'company-1')).resolves.toBeUndefined();

    expect(auditService.recordSafe).toHaveBeenCalledWith(expect.objectContaining({
      action: 'AGT_SANDBOX_FALHOU',
      entityType: 'Payment',
      entityId: 'pay-1',
    }));
  });

  test('uma falha ao carregar/montar o payload (ex.: documento ainda não certificado) também é apanhada e nunca propaga', async () => {
    agtPayloadService.construirPayload.mockRejectedValue(new Error('Fatura não encontrada'));

    await expect(agtSandboxSubmissionService.submeter('FT', 'inv-x', 'company-1')).resolves.toBeUndefined();

    expect(agtSandboxClient.registarFactura).not.toHaveBeenCalled();
    expect(auditService.recordSafe).toHaveBeenCalledWith(expect.objectContaining({
      action: 'AGT_SANDBOX_FALHOU',
      entityType: 'Invoice',
      entityId: 'inv-x',
      detail: expect.objectContaining({ erro: 'Fatura não encontrada' }),
    }));
  });
});
