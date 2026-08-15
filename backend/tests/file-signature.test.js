// tests/file-signature.test.js
// O tipo de um ficheiro é o que os bytes dizem, não o que o pedido declara.
const { auth, request, app, prisma, login } = require('./helpers');
const { verificar, detetar } = require('../src/utils/fileSignature');

const PDF = Buffer.from('%PDF-1.4 documento verdadeiro');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const EXECUTAVEL = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]); // MZ (PE/EXE)

describe('Assinatura de ficheiro', () => {
  test('reconhece os formatos que aceita', () => {
    expect(detetar(PDF).rotulo).toBe('PDF');
    expect(detetar(PNG).rotulo).toBe('PNG');
    expect(detetar(Buffer.from([0xff, 0xd8, 0xff, 0xe0])).rotulo).toBe('JPEG');
    expect(detetar(Buffer.from('RIFF____WEBP____')).rotulo).toBe('WEBP');
  });

  test('deixa passar o que corresponde ao declarado', () => {
    expect(() => verificar(PDF, 'application/pdf', 'a.pdf')).not.toThrow();
    expect(() => verificar(PNG, 'image/png', 'a.png')).not.toThrow();
    // image/jpg não existe formalmente, mas há clientes que o enviam.
    expect(() => verificar(Buffer.from([0xff, 0xd8, 0xff]), 'image/jpg', 'a.jpg')).not.toThrow();
  });

  test('recusa um executável disfarçado de PDF — e diz o que recebeu', () => {
    expect(() => verificar(EXECUTAVEL, 'application/pdf', 'fatura.pdf'))
      .toThrow(/não é de nenhum formato reconhecido/);
  });

  test('recusa um PNG enviado como PDF, nomeando os dois formatos', () => {
    expect(() => verificar(PNG, 'application/pdf', 'x.pdf')).toThrow(/enviado como PDF.*conteúdo é PNG/);
  });

  test('não inventa recusas para tipos que não sabe verificar', () => {
    expect(() => verificar(Buffer.from('qualquer coisa'), 'text/csv', 'x.csv')).not.toThrow();
  });
});

describe('Assinatura — no caminho real do upload', () => {
  let token;
  let invoiceId;

  beforeAll(async () => {
    token = await login('financeiro@petroangola.co.ao');
    const inv = await prisma.invoice.findFirst({ where: { status: 'PENDENTE' }, include: { purchaseOrder: true } });
    invoiceId = inv?.id;
  });

  afterAll(async () => { await prisma.$disconnect(); });

  test('o comprovativo de pagamento é recusado se o conteúdo não for o declarado', async () => {
    if (!invoiceId) return;                       // sem fatura pendente no seed
    const res = await request(app)
      .post(`/api/payments/invoices/${invoiceId}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .attach('proof', EXECUTAVEL, { filename: 'comprovativo.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(422);
    // E nada foi gravado: a fatura continua por pagar.
    const depois = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    expect(depois.status).toBe('PENDENTE');
  });
});
