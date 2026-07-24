// tests/reports.test.js
// Inventário (atualização de stock) e Relatórios do fornecedor.
const { auth, prisma, login } = require('./helpers');

let fornecedorToken;
let productId;
let supplierCompanyId;

beforeAll(async () => {
  fornecedorToken = await login('fornecedor@kianda.co.ao');
  const forn = await prisma.user.findUnique({ where: { email: 'fornecedor@kianda.co.ao' } });
  supplierCompanyId = forn.companyId;
  const prod = await prisma.product.create({
    data: { supplierId: supplierCompanyId, name: 'Item de Inventário', category: 'Materiais', unitPrice: 2000, stockQuantity: 3, minStock: 5 },
  });
  productId = prod.id;
});

afterAll(async () => {
  if (productId) await prisma.product.deleteMany({ where: { id: productId } });
  await prisma.$disconnect();
});

describe('Inventário e Relatórios', () => {
  test('atualiza o stock de um produto da própria empresa', async () => {
    const res = await auth(fornecedorToken)
      .patch(`/api/catalog/${productId}/stock`)
      .send({ stockQuantity: 42, minStock: 10, warehouse: 'Luanda', availability: 'Em stock' });
    expect(res.status).toBe(200);
    expect(res.body.stockQuantity).toBe(42);
    expect(res.body.warehouse).toBe('Luanda');
  });

  test('estatísticas do fornecedor devolvem agregados reais', async () => {
    const res = await auth(fornecedorToken).get('/api/reports/fornecedor');
    expect(res.status).toBe(200);
    expect(typeof res.body.totalProducts).toBe('number');
    expect(res.body.totalProducts).toBeGreaterThan(0);
    expect(res.body).toHaveProperty('revenue');
    expect(res.body).toHaveProperty('statusCounts');
    expect(Array.isArray(res.body.topProducts)).toBe(true);
  });

  test('um comprador não acede às estatísticas do fornecedor (403)', async () => {
    const compradorToken = await login('comprador@petroangola.co.ao');
    const res = await auth(compradorToken).get('/api/reports/fornecedor');
    expect(res.status).toBe(403);
  });
});
