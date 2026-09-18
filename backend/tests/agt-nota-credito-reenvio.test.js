// tests/agt-nota-credito-reenvio.test.js
// POST /api/payments/notas-credito/:creditNoteId/reenviar-agt —
// creditNoteService.reenviarAgt() reenvia a NC à AGT (registarFactura) de
// forma EXPLÍCITA e VISÍVEL — pedido explícito: mesmo tratamento já dado ao
// FT no "Pagar" (ver agt-fatura-resubmissao-pagamento.test.js), agora
// também para a Nota de Crédito. A NC já foi submetida uma vez em emitir()
// (silenciosa, nunca lança — agtSandboxSubmissionService); isto é um
// reenvio deliberado, com o payload e a resposta reais visíveis.
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

// numeroDocumento() (agtPayloadService) exige uma série REAL da AGT
// (AgtSeriesFe) para o tipo do documento — tanto para a própria NC como
// para a FT que ela referencia (documentoDeNotaCredito aponta para o
// documentNo da fatura original). Independente da série fiscal interna
// (Company.serieFiscal) desde a mudança para agtSeriesService.atribuirDocumentNo.
const ANO_TESTE = new Date().getFullYear();
const SERIES_CODE_FT_TESTE = 'NC-REENVIO-FT-TESTE';
const SERIES_CODE_NC_TESTE = 'NC-REENVIO-NC-TESTE';

let tokens;
let product;

beforeAll(async () => {
  tokens = await loginAll();
  const catalog = await auth(tokens.comprador).get('/api/catalog');
  product = catalog.body[0];

  await prisma.agtSeriesFe.createMany({
    data: [
      { ano: ANO_TESTE, tipoDocumento: 'FT', establishmentNumber: config.agt.establishmentNumber, taxRegistrationNumber: 'AO-FOR-0001', seriesCode: SERIES_CODE_FT_TESTE, submissionUUID: crypto.randomUUID(), resultCode: '1' },
      { ano: ANO_TESTE, tipoDocumento: 'NC', establishmentNumber: config.agt.establishmentNumber, taxRegistrationNumber: 'AO-FOR-0001', seriesCode: SERIES_CODE_NC_TESTE, submissionUUID: crypto.randomUUID(), resultCode: '1' },
    ],
  });
});

afterAll(async () => {
  await prisma.agtSeriesFe.deleteMany({ where: { seriesCode: { in: [SERIES_CODE_FT_TESTE, SERIES_CODE_NC_TESTE] } } });
  await prisma.$disconnect();
});

beforeEach(() => {
  // Sandbox "desligada" para a submissão automática/silenciosa da NC em
  // emitir() (agtSandboxSubmissionService) — não é o que este ficheiro
  // testa; evita um segundo registarFactura/mock a interferir com as
  // asserções do reenvio explícito.
  agtSandboxClient.disponivel.mockReturnValue(false);
  // Isola a contagem de chamadas entre testes — os mocks não são limpos
  // automaticamente entre "test()" neste ficheiro.
  agtSandboxClient.registarFactura.mockClear();
  agtSandboxClient.obterEstado.mockClear();
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

async function novaNotaCredito(invoiceId, valor) {
  const res = await auth(tokens.fornecedor)
    .post(`/api/payments/invoices/${invoiceId}/notas-credito`)
    .send({ motivo: 'Correção de teste AGT', amount: valor });
  return res.body;
}

function reenviar(creditNoteId, token = tokens.fornecedor) {
  return auth(token).post(`/api/payments/notas-credito/${creditNoteId}/reenviar-agt`);
}

describe('POST /api/payments/notas-credito/:creditNoteId/reenviar-agt', () => {
  test('a AGT aceita: sucesso=true, com o payload (tipo NC) e a resposta', async () => {
    agtSandboxClient.registarFactura.mockResolvedValue({ requestID: '202600003399111', errorList: [] });
    agtSandboxClient.obterEstado.mockResolvedValue({ resultCode: '0', documentStatusList: [] });

    const { invoice } = await novaFatura();
    const nota = await novaNotaCredito(invoice.id, Number(invoice.amount) / 2);

    const res = await reenviar(nota.id);
    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.payload.documents[0].documentType).toBe('NC');
    expect(res.body.payload.documents[0].documentNo).toMatch(new RegExp(`^NC ${SERIES_CODE_NC_TESTE}/\\d+$`));
    expect(res.body.resposta).toEqual({ requestID: '202600003399111', errorList: [] });
    expect(res.body.estado?.resposta).toEqual({ resultCode: '0', documentStatusList: [] });

    const db = await prisma.creditNote.findUnique({ where: { id: nota.id } });
    expect(db.agtRequestId).toBe('202600003399111');
    expect(db.agtErro).toBeNull();
    expect(db.agtEstado?.resposta).toEqual({ resultCode: '0', documentStatusList: [] });
  });

  test('a AGT recusa: sucesso=false, mas a nota de crédito continua válida (nunca lança)', async () => {
    const erro = new agtSandboxClient.AgtApiError('registarFactura', '1', [{ code: 'E001', message: 'NIF inválido' }]);
    erro.endpoint = 'registarFactura';
    erro.resultCode = '1';
    erro.errorList = [{ code: 'E001', message: 'NIF inválido' }];
    erro.message = 'A AGT recusou o documento.';
    agtSandboxClient.registarFactura.mockRejectedValue(erro);

    const { invoice } = await novaFatura();
    const nota = await novaNotaCredito(invoice.id, Number(invoice.amount) / 2);

    const res = await reenviar(nota.id);
    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.erro?.code).toBe('AGT_RECUSOU');
    expect(res.body.erro?.details?.errorList).toEqual([{ code: 'E001', message: 'NIF inválido' }]);

    const db = await prisma.creditNote.findUnique({ where: { id: nota.id } });
    expect(db.agtErro).toMatchObject({ code: 'AGT_RECUSOU' });
    // A nota em si nunca é desfeita nem invalidada por uma recusa da AGT.
    expect(db.reference).toBe(nota.reference);
    expect(Number(db.amount)).toBeCloseTo(Number(nota.amount));
  });

  test('reenvio repetido devolve o mesmo documentNo (idempotente)', async () => {
    agtSandboxClient.registarFactura.mockResolvedValue({ requestID: '202600003399222', errorList: [] });
    agtSandboxClient.obterEstado.mockResolvedValue({ resultCode: '0' });

    const { invoice } = await novaFatura();
    const nota = await novaNotaCredito(invoice.id, Number(invoice.amount) / 2);

    const primeiro = await reenviar(nota.id);
    const segundo = await reenviar(nota.id);
    expect(primeiro.body.payload.documents[0].documentNo).toBe(segundo.body.payload.documents[0].documentNo);
  });

  test('quem não é o fornecedor desta fatura não consegue reenviar', async () => {
    const { invoice } = await novaFatura();
    const nota = await novaNotaCredito(invoice.id, Number(invoice.amount) / 2);

    const res = await reenviar(nota.id, tokens.comprador);
    expect(res.status).toBe(403);
    expect(agtSandboxClient.registarFactura).not.toHaveBeenCalled();
  });

  test('nota de crédito inexistente devolve 404', async () => {
    const res = await reenviar('00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });
});
