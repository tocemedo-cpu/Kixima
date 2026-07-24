// tests/documents.test.js
// Documentação do fornecedor: reúne documentos de produtos + da empresa.
const { auth, prisma, login } = require('./helpers');

let fornecedorToken;
let productId;
let supplierCompanyId;

beforeAll(async () => {
  fornecedorToken = await login('fornecedor@kianda.co.ao');
  const forn = await prisma.user.findUnique({ where: { email: 'fornecedor@kianda.co.ao' } });
  supplierCompanyId = forn.companyId;

  const prod = await prisma.product.create({
    data: {
      supplierId: supplierCompanyId, name: 'Produto com Documentos', category: 'Materiais', unitPrice: 1000,
      documents: {
        create: [
          { type: 'FICHA_TECNICA', fileUrl: '/api/uploads/ficha.pdf', originalName: 'ficha.pdf' },
          { type: 'CERTIFICADO', fileUrl: '/api/uploads/cert.pdf', originalName: 'cert.pdf' },
        ],
      },
    },
  });
  productId = prod.id;
});

afterAll(async () => {
  if (productId) {
    await prisma.productDocument.deleteMany({ where: { productId } });
    await prisma.product.deleteMany({ where: { id: productId } });
  }
  await prisma.$disconnect();
});

describe('Documentação do fornecedor', () => {
  test('lista documentos de produtos e da empresa', async () => {
    const res = await auth(fornecedorToken).get('/api/catalog/documents');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.productDocs)).toBe(true);
    expect(Array.isArray(res.body.companyDocs)).toBe(true);
    const ficha = res.body.productDocs.find((d) => d.type === 'FICHA_TECNICA' && d.productId === productId);
    expect(ficha).toBeTruthy();
    expect(ficha.productName).toBe('Produto com Documentos');
  });

  test('um comprador não acede aos documentos do fornecedor (403)', async () => {
    const compradorToken = await login('comprador@petroangola.co.ao');
    const res = await auth(compradorToken).get('/api/catalog/documents');
    expect(res.status).toBe(403);
  });
});
