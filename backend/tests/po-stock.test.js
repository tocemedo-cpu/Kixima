// tests/po-stock.test.js
// N9 da auditoria: createPurchaseOrder passa a validar E decrementar o stock
// (stockQuantity) do produto, atomicamente, com guarda contra oversell em
// concorrência. Produtos sem stockQuantity definido (null) continuam sem
// limite — esse campo já significa "não rastreado" em catalogService.
const { request, app, prisma, loginAll, auth } = require('./helpers');

let tokens;
let supplierCompanyId;
const createdProductIds = [];

async function novoProduto(over = {}) {
  const prod = await prisma.product.create({
    data: {
      supplierId: supplierCompanyId, name: `Produto de stock ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      category: 'Materiais', unitPrice: 1000, ...over,
    },
  });
  createdProductIds.push(prod.id);
  return prod;
}

beforeAll(async () => {
  tokens = await loginAll();
  const forn = await prisma.user.findUnique({ where: { email: 'fornecedor@kianda.co.ao' } });
  supplierCompanyId = forn.companyId;
});

afterAll(async () => {
  await prisma.purchaseOrderItem.deleteMany({ where: { productId: { in: createdProductIds } } });
  await prisma.notification.deleteMany({ where: { relatedEntityType: 'Product', relatedEntityId: { in: createdProductIds } } });
  await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
  await prisma.$disconnect();
});

async function checkout(productId, quantity) {
  return auth(tokens.comprador).post('/api/purchase-orders').send({ supplierCompanyId, items: [{ productId, quantity }] });
}

describe('Stock com quantidade rastreada (stockQuantity definido)', () => {
  test('checkout decrementa o stock exatamente pela quantidade pedida', async () => {
    const produto = await novoProduto({ stockQuantity: 10 });
    const res = await checkout(produto.id, 3);
    expect(res.status).toBe(201);

    const depois = await prisma.product.findUnique({ where: { id: produto.id } });
    expect(depois.stockQuantity).toBe(7);
  });

  test('pedir mais do que o stock disponível é recusado, e NADA é decrementado nem criado', async () => {
    const produto = await novoProduto({ stockQuantity: 5 });
    const res = await checkout(produto.id, 6);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/[Ss]tock insuficiente/);

    const depois = await prisma.product.findUnique({ where: { id: produto.id } });
    expect(depois.stockQuantity).toBe(5); // inalterado — a transação reverteu tudo

    const pos = await prisma.purchaseOrder.count({ where: { items: { some: { productId: produto.id } } } });
    expect(pos).toBe(0); // nenhuma PO chegou a ser criada
  });

  test('pedir exatamente o stock restante esgota-o (chega a zero, não a negativo)', async () => {
    const produto = await novoProduto({ stockQuantity: 4 });
    const res = await checkout(produto.id, 4);
    expect(res.status).toBe(201);

    const depois = await prisma.product.findUnique({ where: { id: produto.id } });
    expect(depois.stockQuantity).toBe(0);
  });

  test('duas compras concorrentes que juntas excedem o stock: só uma singular tem sucesso, nunca fica negativo', async () => {
    const produto = await novoProduto({ stockQuantity: 5 });
    // Cada pedido, isolado, cabe no stock (3 <= 5) — mas juntos (6) excedem.
    const [resA, resB] = await Promise.all([checkout(produto.id, 3), checkout(produto.id, 3)]);
    const estados = [resA.status, resB.status].sort();

    expect(estados).toEqual([201, 400]);
    const depois = await prisma.product.findUnique({ where: { id: produto.id } });
    expect(depois.stockQuantity).toBe(2); // 5 - 3, nunca fica negativo
  });
});

describe('Stock sem rastreamento (stockQuantity null) — comportamento inalterado', () => {
  test('checkout não valida nem decrementa quando stockQuantity é null', async () => {
    const produto = await novoProduto({ stockQuantity: null });
    const res = await checkout(produto.id, 500); // quantidade "absurda", sem limite algum
    expect(res.status).toBe(201);

    const depois = await prisma.product.findUnique({ where: { id: produto.id } });
    expect(depois.stockQuantity).toBeNull();
  });
});

describe('Aviso de stock baixo disparado por uma compra (mesma transição de catalogService)', () => {
  test('cruzar o mínimo através de uma PO gera a notificação, uma só vez', async () => {
    const produto = await novoProduto({ stockQuantity: 10, minStock: 5 });
    const res = await checkout(produto.id, 6); // 10 -> 4, cruza o mínimo de 5
    expect(res.status).toBe(201);

    const notificacao = await prisma.notification.findFirst({
      where: { relatedEntityType: 'Product', relatedEntityId: produto.id, type: 'ESTOQUE_BAIXO' },
    });
    expect(notificacao).toBeTruthy();
  });

  test('permanecer abaixo do mínimo numa segunda compra não repete o aviso', async () => {
    const produto = await novoProduto({ stockQuantity: 6, minStock: 5 });
    await checkout(produto.id, 2); // 6 -> 4, cruza
    await checkout(produto.id, 1); // 4 -> 3, já estava abaixo — não repete

    const contagem = await prisma.notification.count({
      where: { relatedEntityType: 'Product', relatedEntityId: produto.id, type: 'ESTOQUE_BAIXO' },
    });
    expect(contagem).toBe(1);
  });
});
