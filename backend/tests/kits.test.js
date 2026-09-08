// tests/kits.test.js
// Kits: pacotes de produtos da própria empresa.
const { auth, prisma, login } = require('./helpers');

let fornecedorToken;
let supplierCompanyId;
let p1, p2;
const createdKitIds = [];

beforeAll(async () => {
  fornecedorToken = await login('fornecedor@kianda.co.ao');
  const forn = await prisma.user.findUnique({ where: { email: 'fornecedor@kianda.co.ao' } });
  supplierCompanyId = forn.companyId;
  p1 = await prisma.product.create({ data: { supplierId: supplierCompanyId, name: 'Kit Item A', category: 'Materiais', unitPrice: 100 } });
  p2 = await prisma.product.create({ data: { supplierId: supplierCompanyId, name: 'Kit Item B', category: 'Materiais', unitPrice: 250 } });
});

afterAll(async () => {
  for (const id of createdKitIds) {
    await prisma.kitItem.deleteMany({ where: { kitId: id } });
    await prisma.kit.deleteMany({ where: { id } });
  }
  await prisma.product.deleteMany({ where: { id: { in: [p1.id, p2.id] } } });
  await prisma.$disconnect();
});

describe('Kits', () => {
  test('cria um kit com produtos da própria empresa', async () => {
    const res = await auth(fornecedorToken).post('/api/kits').send({
      name: 'Kit de Manutenção', description: 'Pacote básico',
      items: [{ productId: p1.id, quantity: 2 }, { productId: p2.id, quantity: 1 }],
    });
    expect(res.status).toBe(201);
    expect(res.body.items).toHaveLength(2);
    createdKitIds.push(res.body.id);
  });

  test('lista os kits da empresa', async () => {
    const res = await auth(fornecedorToken).get('/api/kits');
    expect(res.status).toBe(200);
    expect(res.body.some((k) => k.name === 'Kit de Manutenção')).toBe(true);
  });

  test('rejeita produto de outra empresa (400)', async () => {
    const other = await prisma.product.findFirst({ where: { supplierId: { not: supplierCompanyId } } });
    if (!other) return;
    const res = await auth(fornecedorToken).post('/api/kits').send({ name: 'Kit Inválido', items: [{ productId: other.id, quantity: 1 }] });
    expect(res.status).toBe(400);
  });

  test('criar e remover um kit fica no trilho de auditoria', async () => {
    const criado = await auth(fornecedorToken).post('/api/kits').send({
      name: 'Kit Auditado', items: [{ productId: p1.id, quantity: 1 }],
    });
    expect(criado.status).toBe(201);
    createdKitIds.push(criado.body.id);
    const logCriado = await prisma.auditLog.findFirst({ where: { action: 'CATALOGO_KIT_CRIADO', entityId: criado.body.id } });
    expect(logCriado).toBeTruthy();
    expect(logCriado.entityRef).toBe('Kit Auditado');

    const removido = await auth(fornecedorToken).del(`/api/kits/${criado.body.id}`);
    expect(removido.status).toBe(200);
    const logRemovido = await prisma.auditLog.findFirst({ where: { action: 'CATALOGO_KIT_REMOVIDO', entityId: criado.body.id } });
    expect(logRemovido).toBeTruthy();
  });
});
