// tests/quotes.test.js
// Fluxo de cotação (RFQ): comprador pede -> fornecedor responde -> comprador encerra.
const { auth, prisma, login } = require('./helpers');

let compradorToken, fornecedorToken;
let buyerCompanyId, supplierCompanyId, productId;

beforeAll(async () => {
  compradorToken = await login('comprador@petroangola.co.ao');
  fornecedorToken = await login('fornecedor@kianda.co.ao');
  const comprador = await prisma.user.findUnique({ where: { email: 'comprador@petroangola.co.ao' } });
  const forn = await prisma.user.findUnique({ where: { email: 'fornecedor@kianda.co.ao' } });
  buyerCompanyId = comprador.companyId;
  supplierCompanyId = forn.companyId;
  const prod = await prisma.product.findFirst({ where: { supplierId: supplierCompanyId } });
  productId = prod.id;
});

afterAll(async () => {
  await prisma.quoteItem.deleteMany({ where: { quoteRequest: { buyerCompanyId } } });
  await prisma.quoteRequest.deleteMany({ where: { buyerCompanyId } });
  await prisma.$disconnect();
});

describe('Cotações (RFQ)', () => {
  let quoteId;

  test('comprador cria um pedido de cotação (ABERTA)', async () => {
    const res = await auth(compradorToken).post('/api/quotes').send({
      supplierCompanyId, note: 'Preciso com urgência', items: [{ productId, quantity: 3 }],
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ABERTA');
    quoteId = res.body.id;
  });

  test('fornecedor vê a solicitação e responde (RESPONDIDA)', async () => {
    const list = await auth(fornecedorToken).get('/api/quotes').query({ status: 'ABERTA' });
    expect(list.body.some((q) => q.id === quoteId)).toBe(true);

    const res = await auth(fornecedorToken).patch(`/api/quotes/${quoteId}/respond`).send({ price: 45000, leadDays: 10, note: 'Inclui transporte' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('RESPONDIDA');
    expect(Number(res.body.responsePrice)).toBe(45000);
  });

  test('comprador vê a resposta e encerra (FECHADA)', async () => {
    const res = await auth(compradorToken).patch(`/api/quotes/${quoteId}/close`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('FECHADA');
  });

  test('não se pode pedir cotação à própria empresa (400)', async () => {
    const res = await auth(compradorToken).post('/api/quotes').send({ supplierCompanyId: buyerCompanyId, items: [{ productId, quantity: 1 }] });
    expect(res.status).toBe(400);
  });

  test('um fornecedor não pode criar pedidos de cotação (403)', async () => {
    const res = await auth(fornecedorToken).post('/api/quotes').send({ supplierCompanyId, items: [{ productId, quantity: 1 }] });
    expect(res.status).toBe(403);
  });
});
