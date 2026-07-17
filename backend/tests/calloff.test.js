// tests/calloff.test.js
// Contratos-quadro e Call-offs (secção 5): quando existe um contrato ativo a
// cobrir fornecedor + categoria, a PO é automaticamente marcada como Call-off e
// salta o passo de aprovação individual.

const { auth, prisma, loginAll, USERS } = require('./helpers');

let tokens;
let product;
let clientCompanyId;

beforeAll(async () => {
  tokens = await loginAll();
  const catalog = await auth(tokens.comprador).get('/api/catalog');
  product = catalog.body[0];

  const comprador = await prisma.user.findUnique({ where: { email: USERS.comprador } });
  clientCompanyId = comprador.companyId;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Call-off a partir de contrato-quadro', () => {
  test('PO coberta por contrato ativo torna-se Call-off e salta a aprovação', async () => {
    // Admin do Sistema cria um contrato-quadro cobrindo o fornecedor + categoria.
    const validFrom = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const validUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    const contractRes = await auth(tokens.adminSistema)
      .post('/api/contracts')
      .send({
        clientCompanyId,
        supplierCompanyId: product.supplierId,
        categoriesCovered: [product.category],
        totalValue: 100000000,
        currency: 'AOA',
        billingPeriodicity: 'TRIMESTRAL',
        paymentTermDays: 30,
        validFrom,
        validUntil,
      });
    expect(contractRes.status).toBeLessThan(300);

    // Comprador emite uma PO para esse fornecedor/categoria.
    const poRes = await auth(tokens.comprador)
      .post('/api/purchase-orders')
      .send({ supplierCompanyId: product.supplierId, items: [{ productId: product.id, quantity: 1 }] });
    expect(poRes.status).toBeLessThan(300);

    const po = poRes.body;
    // Deve ser detetada como Call-off.
    expect(po.isCallOff).toBe(true);
    // E não fica à espera de aprovação individual.
    expect(po.status).not.toBe('AGUARDANDO_APROVACAO');

    // Aprovar um Call-off individualmente é uma violação de regra de negócio.
    const approveRes = await auth(tokens.companyAdmin).patch(`/api/purchase-orders/${po.id}/approve`);
    expect(approveRes.status).toBeGreaterThanOrEqual(400);
  });
});
