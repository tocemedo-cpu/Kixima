// tests/agt-fatura-resubmissao-pagamento.test.js
// Ao confirmar o pagamento de uma fatura (POST /api/payments/invoices/:id/pay),
// agtPayloadService.submeterFatura() reenvia o FT à AGT (registarFactura) —
// pedido explícito do utilizador: o FT já foi submetido uma vez na emissão
// da fatura (poService.js), isto é um reenvio deliberado, com visibilidade
// do payload/resposta em vez de acontecer em silêncio como o RC
// (agtSandboxSubmissionService). NUNCA bloqueia o pagamento: o dinheiro já
// saiu, uma recusa de paperwork da AGT não desfaz isso — testado abaixo com
// a AGT a aceitar e a recusar.
//
// Mesmo cuidado dos outros ficheiros de teste de AGT: a configuração (chave
// privada RSA, número de validação) é lida UMA VEZ ao carregar os módulos,
// por isso é injetada em process.env ANTES de qualquer require.
const crypto = require('crypto');

const { privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
process.env.AGT_JWS_PRIVATE_KEY_BASE64 = Buffer.from(privateKey).toString('base64');
process.env.AGT_SOFTWARE_VALIDATION_NUMBER = 'FE/00/2025/AGT-TESTE';

jest.mock('../src/services/agtSandboxClient');

const config = require('../src/config/env');
const agtSandboxClient = require('../src/services/agtSandboxClient');
const { auth, prisma, loginAll } = require('./helpers');

const PROOF = Buffer.from('%PDF-1.4 comprovativo de teste');

// numeroDocumento() (agtPayloadService) exige uma série REAL atribuída pela
// AGT para o tipo FT (AgtSeriesFe) — agtSeriesService.atribuirDocumentNo()
// atribui o número atomicamente a partir dela, INDEPENDENTE da série fiscal
// interna da empresa (Company.serieFiscal/Invoice.numeroNaSerie, que é só a
// cadeia de hash própria do KIXIMA). Sem essa série, o reenvio falhava com
// BusinessRuleError antes sequer de chegar à AGT (mock) — por isso é
// declarada aqui e removida no fim.
const ANO_TESTE = new Date().getFullYear();
const SERIES_CODE_FT_TESTE = 'RESUBMISSAO-FT-TESTE';

let tokens;
let product;

beforeAll(async () => {
  tokens = await loginAll();
  const catalog = await auth(tokens.comprador).get('/api/catalog');
  product = catalog.body[0];

  await prisma.agtSeriesFe.create({
    data: {
      ano: ANO_TESTE,
      tipoDocumento: 'FT',
      establishmentNumber: config.agt.establishmentNumber,
      taxRegistrationNumber: 'AO-FOR-0001',
      seriesCode: SERIES_CODE_FT_TESTE,
      submissionUUID: crypto.randomUUID(),
      resultCode: '1',
    },
  });
});

afterAll(async () => {
  // As faturas/pagamentos criados aqui (fluxo real de PO -> pagamento) já têm
  // Payment/PlatformFee a apontar para eles — este ficheiro não os apaga.
  await prisma.agtSeriesFe.deleteMany({ where: { seriesCode: SERIES_CODE_FT_TESTE } });
  await prisma.$disconnect();
});

beforeEach(() => {
  // Sandbox não "configurada" para efeitos de agtSandboxSubmissionService
  // (a submissão RC, silenciosa) — não é o que este ficheiro testa; evita
  // um segundo registarFactura/mock a interferir com as asserções do FT.
  agtSandboxClient.disponivel.mockReturnValue(false);
});

// Leva uma PO nova até ter fatura pendente; devolve { po, invoice }.
async function novaFatura() {
  const created = await auth(tokens.comprador)
    .post('/api/purchase-orders')
    .send({ supplierCompanyId: product.supplierId, items: [{ productId: product.id, quantity: 1 }] });
  const po = created.body;
  await auth(tokens.companyAdmin).patch(`/api/purchase-orders/${po.id}/approve`);
  await auth(tokens.fornecedor).patch(`/api/purchase-orders/${po.id}/accept`);
  const full = await auth(tokens.financeiro).get(`/api/purchase-orders/${po.id}`);
  return { po, invoice: full.body.invoice };
}

function pagar(invoiceId) {
  return auth(tokens.financeiro).post(`/api/payments/invoices/${invoiceId}/pay`).attach('proof', PROOF, 'comprovativo.pdf');
}

describe('POST /api/payments/invoices/:id/pay — reenvio do FT à AGT', () => {
  test('a AGT aceita: agtInvoiceResubmission.sucesso=true, com o payload e a resposta', async () => {
    agtSandboxClient.registarFactura.mockResolvedValue({ resultCode: '0', documentNo: 'FT-QUALQUER' });

    const { invoice } = await novaFatura();
    const res = await pagar(invoice.id);

    expect(res.status).toBe(201);
    expect(res.body.agtInvoiceResubmission?.sucesso).toBe(true);
    expect(res.body.agtInvoiceResubmission?.payload?.documents?.[0]?.documentType).toBe('FT');
    // documentNo usa a série REAL da AGT (AgtSeriesFe), não a referência
    // interna da fatura — é exatamente esta troca que corrige a recusa real
    // já vista ("FT FAT-2026-000009").
    expect(res.body.agtInvoiceResubmission?.payload?.documents?.[0]?.documentNo)
      .toMatch(new RegExp(`^FT ${SERIES_CODE_FT_TESTE}/\\d+$`));
    expect(res.body.agtInvoiceResubmission?.resposta).toEqual({ resultCode: '0', documentNo: 'FT-QUALQUER' });
    expect(agtSandboxClient.registarFactura).toHaveBeenCalledTimes(1);

    // O pagamento em si foi processado — o reenvio é à parte.
    const db = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    expect(db.status).toBe('PAGA');
    // O resultado do reenvio fica gravado na própria fatura — sem isto só
    // existia na resposta HTTP deste pedido.
    expect(db.agtResultCode).toBe('0');
    expect(db.agtErro).toBeNull();
  });

  test('a AGT recusa o FT (documentNo repetido, por exemplo): o pagamento continua a suceder', async () => {
    const erro = new agtSandboxClient.AgtApiError('registarFactura', '1', [{ code: 'E002', message: 'documentNo já existe' }]);
    erro.endpoint = 'registarFactura';
    erro.resultCode = '1';
    erro.errorList = [{ code: 'E002', message: 'documentNo já existe' }];
    erro.message = 'A AGT recusou o documento.';
    agtSandboxClient.registarFactura.mockRejectedValue(erro);

    const { invoice } = await novaFatura();
    const res = await pagar(invoice.id);

    // O pagamento sobrevive à recusa — nunca é bloqueado nem desfeito.
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PROCESSADO');
    expect(res.body.agtInvoiceResubmission?.sucesso).toBe(false);
    expect(res.body.agtInvoiceResubmission?.erro?.code).toBe('AGT_RECUSOU');
    expect(res.body.agtInvoiceResubmission?.erro?.details?.errorList).toEqual([{ code: 'E002', message: 'documentNo já existe' }]);

    const db = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    expect(db.status).toBe('PAGA');
    // A recusa também fica gravada — não só na resposta HTTP deste pedido.
    expect(db.agtResultCode).toBe('1');
    expect(db.agtErro).toMatchObject({ code: 'AGT_RECUSOU', details: { errorList: [{ code: 'E002', message: 'documentNo já existe' }] } });
  });

  test('a AGT recusa mas ainda assim atribui requestID: fica gravado (é o que permite consultar o estado depois)', async () => {
    const erro = new agtSandboxClient.AgtApiError('registarFactura', undefined, [{ code: 'E001', message: 'NIF inválido' }]);
    erro.message = 'A AGT recusou o documento.';
    // respostaBruta — o corpo COMPLETO da resposta, incluindo requestID
    // mesmo numa recusa (ver o comentário em agtSandboxClient.AgtApiError).
    erro.respostaBruta = { requestID: '202600003399999', errorList: [{ code: 'E001', message: 'NIF inválido' }] };
    agtSandboxClient.registarFactura.mockRejectedValue(erro);

    const { invoice } = await novaFatura();
    await pagar(invoice.id);

    const db = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    expect(db.agtRequestId).toBe('202600003399999');
  });

  test('assim que há requestID, consulta logo obterEstado sozinho — sem esperar por uma ação manual', async () => {
    agtSandboxClient.registarFactura.mockResolvedValue({ requestID: '202600003355688', errorList: [] });
    const ESTADO_REAL_AGT = {
      requestID: '202600003355688', resultCode: '0', taxRegistrationNumber: '5403096116',
      documentStatusList: [{ documentNo: 'FT FT7626S11894N/1', documentStatus: 'V', errorList: [''] }],
      requestErrorList: [''], successRequestID: '',
    };
    agtSandboxClient.obterEstado.mockResolvedValue(ESTADO_REAL_AGT);

    const { invoice } = await novaFatura();
    const res = await pagar(invoice.id);

    const documentNo = res.body.agtInvoiceResubmission?.payload?.documents?.[0]?.documentNo;
    expect(agtSandboxClient.obterEstado).toHaveBeenCalledWith(expect.objectContaining({
      taxRegistrationNumber: 'AO-FOR-0001', invoiceNo: documentNo,
    }));
    expect(res.body.agtInvoiceResubmission?.estado).toEqual(ESTADO_REAL_AGT);

    const db = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    expect(db.agtEstado).toEqual(ESTADO_REAL_AGT);
  });
});

describe('GET /api/faturacao/agt-estado/:invoiceId — consulta o estado real na AGT (obterEstado)', () => {
  beforeEach(() => {
    // Esta rota SUBMETE mesmo o pedido à AGT (obterEstado) — precisa da
    // Sandbox "configurada" (ao contrário do beforeEach de topo, que a
    // desliga para não interferir com a submissão silenciosa do RC).
    agtSandboxClient.disponivel.mockReturnValue(true);
    agtSandboxClient.emFalta.mockReturnValue([]);
    // Isola a contagem de chamadas: submeterFatura() já consulta
    // obterEstado() sozinho assim que há requestID (ver describe anterior) —
    // sem limpar aqui, essa chamada de um teste anterior contaria para a
    // asserção "not.toHaveBeenCalled()" abaixo.
    agtSandboxClient.obterEstado.mockClear();
  });

  test('sem nenhum documentNo atribuído ainda, recusa com mensagem clara em vez de consultar', async () => {
    // Sandbox "desligada" enquanto a fatura é criada — senão a submissão
    // silenciosa do FT na emissão (agtSandboxSubmissionService, ver
    // poService.acceptPurchaseOrder) já atribuiria o documentNo sozinha.
    agtSandboxClient.disponivel.mockReturnValue(false);
    const { invoice } = await novaFatura();

    // A rota em si exige a Sandbox "configurada" (exigirSandboxAgtConfigurada).
    agtSandboxClient.disponivel.mockReturnValue(true);
    const res = await auth(tokens.fornecedor).get(`/api/faturacao/agt-estado/${invoice.id}`);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/ainda não tem nenhum documentNo/);
    expect(agtSandboxClient.obterEstado).not.toHaveBeenCalled();
  });

  test('com documentNo atribuído (fatura já paga com sucesso), consulta a AGT com o envelope assinado', async () => {
    agtSandboxClient.registarFactura.mockResolvedValue({ requestID: '202600003355688', errorList: [] });
    agtSandboxClient.obterEstado.mockResolvedValue({ resultCode: '0', status: 'PROCESSADO', motivo: null });

    const { invoice } = await novaFatura();
    await pagar(invoice.id);
    const db = await prisma.invoice.findUnique({ where: { id: invoice.id } });

    const res = await auth(tokens.fornecedor).get(`/api/faturacao/agt-estado/${invoice.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ resultCode: '0', status: 'PROCESSADO', motivo: null });
    expect(agtSandboxClient.obterEstado).toHaveBeenCalledWith(expect.objectContaining({
      taxRegistrationNumber: 'AO-FOR-0001', invoiceNo: db.agtDocumentNo,
    }));
  });

  test('um fornecedor não consegue consultar o estado de uma fatura de outra empresa', async () => {
    const { invoice } = await novaFatura();
    const outro = await prisma.company.create({
      data: { name: 'Fornecedora Isolada AGT Estado', taxId: `AO-TEST-AGTESTADO-${Date.now()}`, type: 'FORNECEDOR', contactEmail: 'iso-estado@test.co.ao', status: 'APROVADA' },
    });
    try {
      // O Admin do Sistema tem de indicar a empresa via query — indicando a
      // "outra" isolada, a fatura (do fornecedor real) não lhe pertence.
      const res = await auth(tokens.adminSistema).get(`/api/faturacao/agt-estado/${invoice.id}?supplierCompanyId=${outro.id}`);
      expect(res.status).toBe(403);
    } finally {
      await prisma.company.delete({ where: { id: outro.id } });
    }
  });
});
