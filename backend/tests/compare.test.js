// tests/compare.test.js
// Comparar fornecedores (só comprador): reúne várias ofertas do MESMO item
// (mesmo código UNSPSC) de fornecedores diferentes, ordenadas por preço.
const { auth, prisma, login } = require('./helpers');

const CODE = 'CMP-TEST-0001';
let compToken, fornToken;
const created = { companies: [], products: [] };

async function makeSupplierWithProduct({ name, taxId, price, lead, incoterm, material }) {
  const company = await prisma.company.create({
    data: { name, taxId, type: 'FORNECEDOR', status: 'APROVADA', verified: true, contactEmail: `${taxId}@t.co`, city: 'Luanda', country: 'Angola', approvedAt: new Date() },
  });
  const product = await prisma.product.create({
    data: {
      supplierId: company.id, name: 'Válvula de comparação', category: 'Válvulas e Conexões',
      unspscCode: CODE, unitPrice: price, currency: 'AOA', leadTimeDays: lead,
      incoterm, material, warranty: '12 meses', standard: 'API 6D', active: true,
    },
  });
  created.companies.push(company.id);
  created.products.push(product.id);
  return product;
}

beforeAll(async () => {
  compToken = await login('comprador@petroangola.co.ao');
  fornToken = await login('fornecedor@kianda.co.ao');
  await makeSupplierWithProduct({ name: 'Fornecedor A', taxId: 'CMP-A', price: 900000, lead: 20, incoterm: 'DAP', material: 'Aço carbono' });
  await makeSupplierWithProduct({ name: 'Fornecedor B', taxId: 'CMP-B', price: 750000, lead: 30, incoterm: 'EXW', material: 'Inox 316' });
  await makeSupplierWithProduct({ name: 'Fornecedor C', taxId: 'CMP-C', price: 1100000, lead: 10, incoterm: 'CIF', material: 'Aço carbono' });
});

afterAll(async () => {
  await prisma.product.deleteMany({ where: { id: { in: created.products } } });
  await prisma.company.deleteMany({ where: { id: { in: created.companies } } });
  await prisma.$disconnect();
});

describe('Comparar fornecedores', () => {
  test('o comprador obtém as ofertas do mesmo item, ordenadas por preço', async () => {
    const base = created.products[0];
    const res = await auth(compToken).get(`/api/marketplace/compare?productId=${base}`);
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(3);
    // Todos os itens têm o mesmo código UNSPSC.
    expect(res.body.offers.every((o) => o.unspscCode === CODE)).toBe(true);
    // Ordenado por preço efetivo ascendente (B=750k < A=900k < C=1.1M).
    const prices = res.body.offers.map((o) => Number(o.promoPrice ?? o.unitPrice));
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(prices[0]).toBe(750000);
    // Traz os campos de comparação e o fornecedor.
    const first = res.body.offers[0];
    expect(first.supplier?.name).toBeTruthy();
    expect(first.incoterm).toBe('EXW');
    expect(first.material).toBe('Inox 316');
  });

  test('exclui os produtos da própria empresa do comprador', async () => {
    // Cria uma oferta pertencente à empresa do comprador → não deve aparecer.
    const me = await auth(compToken).get('/api/auth/me');
    const myCompanyId = me.body.user?.companyId || me.body.companyId;
    const mine = await prisma.product.create({
      data: { supplierId: myCompanyId, name: 'Minha válvula', category: 'Válvulas e Conexões', unspscCode: CODE, unitPrice: 500000, currency: 'AOA', active: true },
    });
    created.products.push(mine.id);
    const res = await auth(compToken).get(`/api/marketplace/compare?productId=${created.products[0]}`);
    expect(res.body.offers.some((o) => o.id === mine.id)).toBe(false);
  });

  test('um fornecedor NÃO pode aceder à comparação (403)', async () => {
    const res = await auth(fornToken).get(`/api/marketplace/compare?productId=${created.products[0]}`);
    expect(res.status).toBe(403);
  });

  test('sem productId devolve erro (422)', async () => {
    const res = await auth(compToken).get('/api/marketplace/compare');
    expect(res.status).toBe(422);
  });
});
