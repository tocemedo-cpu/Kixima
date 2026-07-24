// tests/self-purchase.test.js
// Regra: um comprador não pode comprar mercadorias da própria empresa — não as
// vê no catálogo nem consegue emitir uma PO contra a própria empresa.
const { auth, prisma, login } = require('./helpers');

let compradorToken;
let compradorCompanyId;
let ownProductId;
let otherProduct;

beforeAll(async () => {
  compradorToken = await login('comprador@petroangola.co.ao');
  const comprador = await prisma.user.findUnique({ where: { email: 'comprador@petroangola.co.ao' } });
  compradorCompanyId = comprador.companyId;

  // Produto "da própria empresa" do comprador (cenário: empresa também fornece).
  const own = await prisma.product.create({
    data: { supplierId: compradorCompanyId, name: 'Item da Própria Empresa', category: 'Materiais', unitPrice: 1000 },
  });
  ownProductId = own.id;

  // Um produto de outro fornecedor (para o caminho válido).
  const catalog = await auth(compradorToken).get('/api/catalog');
  otherProduct = catalog.body[0];
});

afterAll(async () => {
  if (ownProductId) await prisma.product.deleteMany({ where: { id: ownProductId } });
  await prisma.$disconnect();
});

describe('Comprador não compra da própria empresa', () => {
  test('o catálogo do comprador não mostra produtos da própria empresa', async () => {
    const res = await auth(compradorToken).get('/api/catalog');
    expect(res.status).toBe(200);
    expect(res.body.some((p) => p.id === ownProductId)).toBe(false);
    expect(res.body.every((p) => p.supplierId !== compradorCompanyId)).toBe(true);
  });

  test('emitir PO contra a própria empresa é rejeitado (400)', async () => {
    const res = await auth(compradorToken)
      .post('/api/purchase-orders')
      .send({ supplierCompanyId: compradorCompanyId, items: [{ productId: ownProductId, quantity: 1 }] });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/própria empresa/i);
  });

  test('comprar de outro fornecedor continua a funcionar', async () => {
    const res = await auth(compradorToken)
      .post('/api/purchase-orders')
      .send({ supplierCompanyId: otherProduct.supplierId, items: [{ productId: otherProduct.id, quantity: 1 }] });
    expect(res.status).toBeLessThan(300);
  });
});
