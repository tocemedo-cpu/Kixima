// tests/agt-anular-fatura.test.js
// POST /api/payments/invoices/:id/anular — a ação dedicada "Anular Fatura"
// (ver creditNoteService.anular()): cria uma nota de crédito pelo valor
// TOTAL ainda por creditar e, de seguida, submete-a à AGT (registarFactura)
// de forma explícita e visível — mesmo princípio do reenvio do FT ao
// confirmar o pagamento (ver agt-fatura-resubmissao-pagamento.test.js), aqui
// aplicado à NC gerada pela anulação.
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

const ANO_TESTE = new Date().getFullYear();
const SERIES_CODE_FT_TESTE = 'ANULAR-FT-TESTE';
const SERIES_CODE_NC_TESTE = 'ANULAR-NC-TESTE';

let tokens;
let product;

beforeAll(async () => {
  tokens = await loginAll();
  const catalog = await auth(tokens.comprador).get('/api/catalog');
  product = catalog.body[0];

  // numeroDocumento() (agtPayloadService) exige uma série REAL da AGT para
  // FT (referenciada de dentro da NC, como documento original) e para NC
  // (o próprio documento da anulação) — ver o mesmo cuidado em
  // agt-fatura-resubmissao-pagamento.test.js.
  await prisma.agtSeriesFe.createMany({
    data: [
      {
        ano: ANO_TESTE, tipoDocumento: 'FT', establishmentNumber: config.agt.establishmentNumber,
        taxRegistrationNumber: 'AO-FOR-0001', seriesCode: SERIES_CODE_FT_TESTE,
        submissionUUID: crypto.randomUUID(), resultCode: '1',
      },
      {
        ano: ANO_TESTE, tipoDocumento: 'NC', establishmentNumber: config.agt.establishmentNumber,
        taxRegistrationNumber: 'AO-FOR-0001', seriesCode: SERIES_CODE_NC_TESTE,
        submissionUUID: crypto.randomUUID(), resultCode: '1',
      },
    ],
  });
});

afterAll(async () => {
  await prisma.agtSeriesFe.deleteMany({ where: { seriesCode: { in: [SERIES_CODE_FT_TESTE, SERIES_CODE_NC_TESTE] } } });
  await prisma.$disconnect();
});

beforeEach(() => {
  // Desliga a submissão silenciosa (agtSandboxSubmissionService, dentro de
  // creditNoteService.emitir()) para não interferir com as asserções sobre a
  // submissão explícita (submeterNotaCredito) — mesmo cuidado do ficheiro de
  // resubmissão do FT.
  agtSandboxClient.disponivel.mockReturnValue(false);
});

// Leva uma PO nova até ter fatura pendente; devolve { po, invoice }.
async function novaFatura() {
  const created = await auth(tokens.comprador)
    .post('/api/purchase-orders')
    .send({ supplierCompanyId: product.supplierId, items: [{ productId: product.id, quantity: 2 }] });
  const po = created.body;
  await auth(tokens.companyAdmin).patch(`/api/purchase-orders/${po.id}/approve`);
  await auth(tokens.fornecedor).patch(`/api/purchase-orders/${po.id}/accept`);
  const full = await auth(tokens.financeiro).get(`/api/purchase-orders/${po.id}`);
  return { po, invoice: full.body.invoice };
}

function anular(invoiceId, body, token = tokens.fornecedor) {
  return auth(token).post(`/api/payments/invoices/${invoiceId}/anular`).send(body || {});
}

describe('POST /api/payments/invoices/:id/anular', () => {
  test('cria uma NC pelo valor total e submete-a à AGT — sucesso', async () => {
    agtSandboxClient.registarFactura.mockResolvedValue({ requestID: '202600009900001', errorList: [] });

    const { invoice } = await novaFatura();
    const res = await anular(invoice.id, { motivo: 'Pedido de cancelamento do comprador' });

    expect(res.status).toBe(201);
    expect(res.body.creditNote?.reference).toMatch(/^NC-/);
    expect(Number(res.body.creditNote?.amount)).toBeCloseTo(Number(invoice.amount));
    expect(res.body.creditNote?.motivo).toBe('Pedido de cancelamento do comprador');

    expect(res.body.agtSubmission?.sucesso).toBe(true);
    expect(res.body.agtSubmission?.payload?.documents?.[0]?.documentType).toBe('NC');
    expect(res.body.agtSubmission?.payload?.documents?.[0]?.documentNo)
      .toMatch(new RegExp(`^NC ${SERIES_CODE_NC_TESTE}/\\d+$`));
    expect(res.body.agtSubmission?.resposta).toEqual({ requestID: '202600009900001', errorList: [] });

    // A fatura fica intacta — a anulação é um documento à parte.
    const dbInvoice = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    expect(Number(dbInvoice.amount)).toBeCloseTo(Number(invoice.amount));

    // O resultado da submissão fica gravado na própria NC.
    const dbNota = await prisma.creditNote.findUnique({ where: { id: res.body.creditNote.id } });
    expect(dbNota.agtRequestId).toBe('202600009900001');
    expect(dbNota.agtErro).toBeNull();
  });

  test('a AGT recusa a submissão: a NC já criada continua válida, a recusa fica visível e gravada', async () => {
    const erro = new agtSandboxClient.AgtApiError('registarFactura', '1', [{ code: 'E002', message: 'documentNo já existe' }]);
    erro.message = 'A AGT recusou o documento.';
    agtSandboxClient.registarFactura.mockRejectedValue(erro);

    const { invoice } = await novaFatura();
    const res = await anular(invoice.id, {});

    expect(res.status).toBe(201);
    expect(res.body.creditNote?.reference).toMatch(/^NC-/);
    expect(res.body.agtSubmission?.sucesso).toBe(false);
    expect(res.body.agtSubmission?.erro?.code).toBe('AGT_RECUSOU');

    const dbNota = await prisma.creditNote.findUnique({ where: { id: res.body.creditNote.id } });
    expect(dbNota.agtErro).toMatchObject({ code: 'AGT_RECUSOU' });
  });

  test('sem motivo indicado, usa um motivo por omissão referindo a fatura', async () => {
    agtSandboxClient.registarFactura.mockResolvedValue({ requestID: '202600009900002', errorList: [] });

    const { invoice } = await novaFatura();
    const res = await anular(invoice.id, {});

    expect(res.status).toBe(201);
    expect(res.body.creditNote?.motivo).toContain(invoice.reference);
  });

  test('recusa anular uma fatura já totalmente creditada', async () => {
    agtSandboxClient.registarFactura.mockResolvedValue({ requestID: '202600009900003', errorList: [] });

    const { invoice } = await novaFatura();
    const primeira = await anular(invoice.id, {});
    expect(primeira.status).toBe(201);

    const segunda = await anular(invoice.id, {});
    expect(segunda.status).toBe(409);
    expect(segunda.body.error.message).toMatch(/totalmente creditada/);
  });

  test('só o fornecedor DESTA fatura (ou o Admin do Sistema) pode anulá-la', async () => {
    const { invoice } = await novaFatura();

    const comoComprador = await anular(invoice.id, {}, tokens.comprador);
    expect(comoComprador.status).toBe(403);

    const comoFinanceiro = await anular(invoice.id, {}, tokens.financeiro);
    expect(comoFinanceiro.status).toBe(403);
  });
});
