// tests/movements.test.js
// Movimentos de inventário (Entradas/Saídas) que ajustam o stock.
const { auth, prisma, login } = require('./helpers');

let fornecedorToken;
let productId;
let supplierCompanyId;

beforeAll(async () => {
  fornecedorToken = await login('fornecedor@kianda.co.ao');
  const forn = await prisma.user.findUnique({ where: { email: 'fornecedor@kianda.co.ao' } });
  supplierCompanyId = forn.companyId;
  const prod = await prisma.product.create({
    data: { supplierId: supplierCompanyId, name: 'Item de Movimentos', category: 'Materiais', unitPrice: 1000, stockQuantity: 10 },
  });
  productId = prod.id;
});

afterAll(async () => {
  if (productId) {
    await prisma.stockMovement.deleteMany({ where: { productId } });
    await prisma.product.deleteMany({ where: { id: productId } });
  }
  await prisma.$disconnect();
});

describe('Movimentos de inventário', () => {
  test('uma entrada aumenta o stock', async () => {
    const res = await auth(fornecedorToken).post('/api/catalog/movements').send({ productId, type: 'ENTRADA', quantity: 5 });
    expect(res.status).toBe(201);
    const prod = await prisma.product.findUnique({ where: { id: productId } });
    expect(prod.stockQuantity).toBe(15);
  });

  test('uma saída reduz o stock (nunca abaixo de 0)', async () => {
    const res = await auth(fornecedorToken).post('/api/catalog/movements').send({ productId, type: 'SAIDA', quantity: 100 });
    expect(res.status).toBe(201);
    const prod = await prisma.product.findUnique({ where: { id: productId } });
    expect(prod.stockQuantity).toBe(0);
  });

  test('lista movimentos filtrando por tipo', async () => {
    const res = await auth(fornecedorToken).get('/api/catalog/movements').query({ type: 'ENTRADA' });
    expect(res.status).toBe(200);
    expect(res.body.every((m) => m.type === 'ENTRADA')).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('não regista movimento em produto de outra empresa (404)', async () => {
    const other = await prisma.product.findFirst({ where: { supplierId: { not: supplierCompanyId } } });
    if (!other) return; // sem produto de outra empresa no seed
    const res = await auth(fornecedorToken).post('/api/catalog/movements').send({ productId: other.id, type: 'ENTRADA', quantity: 1 });
    expect(res.status).toBe(404);
  });
});
