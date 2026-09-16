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

// numeroDocumento() (agtPayloadService) agora exige DOIS pré-requisitos reais
// para gerar um documentNo: (1) a série fiscal INTERNA da empresa fornecedora
// (Company.serieFiscal — sem ela não há numeroNaSerie nenhum, e o seed de
// testes não a declara por omissão, mesmo padrão de credit-note.test.js) e
// (2) uma série REAL atribuída pela AGT para o tipo FT (AgtSeriesFe). Sem
// qualquer uma das duas, o reenvio falhava com BusinessRuleError antes
// sequer de chegar à AGT (mock) — por isso ambas são declaradas aqui e
// restauradas/removidas no fim, tal como credit-note.test.js já faz para a
// primeira.
const ANO_TESTE = new Date().getFullYear();
const SERIES_CODE_FT_TESTE = 'RESUBMISSAO-FT-TESTE';
const SERIE_FISCAL_TESTE = 'RESUB-TESTE';

let tokens;
let product;
let serieFiscalOriginal;

beforeAll(async () => {
  tokens = await loginAll();
  const catalog = await auth(tokens.comprador).get('/api/catalog');
  product = catalog.body[0];

  const fornecedor = await prisma.company.findUnique({ where: { id: product.supplierId } });
  serieFiscalOriginal = fornecedor.serieFiscal;
  await auth(tokens.adminSistema)
    .put(`/api/companies/${product.supplierId}/serie-fiscal`)
    .send({ serieFiscal: SERIE_FISCAL_TESTE });

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
  // Payment/PlatformFee a apontar para eles — tal como antes desta mudança,
  // este ficheiro não os apaga (só restaura a configuração que alterou).
  await auth(tokens.adminSistema)
    .put(`/api/companies/${product.supplierId}/serie-fiscal`)
    .send({ serieFiscal: serieFiscalOriginal });
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
      .toBe(`FT ${SERIES_CODE_FT_TESTE}/${invoice.numeroNaSerie}`);
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
