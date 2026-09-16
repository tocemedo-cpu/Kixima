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

const agtSandboxClient = require('../src/services/agtSandboxClient');
const { auth, prisma, loginAll } = require('./helpers');

const PROOF = Buffer.from('%PDF-1.4 comprovativo de teste');

let tokens;
let product;

beforeAll(async () => {
  tokens = await loginAll();
  const catalog = await auth(tokens.comprador).get('/api/catalog');
  product = catalog.body[0];
});

afterAll(async () => {
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
    expect(res.body.agtInvoiceResubmission?.resposta).toEqual({ resultCode: '0', documentNo: 'FT-QUALQUER' });
    expect(agtSandboxClient.registarFactura).toHaveBeenCalledTimes(1);

    // O pagamento em si foi processado — o reenvio é à parte.
    const db = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    expect(db.status).toBe('PAGA');
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
  });
});
