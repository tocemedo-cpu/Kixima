// tests/catalog-fornecedor-melhorias.test.js
// Melhorias ao catálogo do Fornecedor: editar um item publicado (acrescentar/
// remover galeria e documentos, respeitando o limite do plano), notificação
// de stock baixo (só na transição), auditoria das ações de catálogo pelo
// painel, e companyPlan exposto em req.user.
const { auth, prisma, login } = require('./helpers');

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');

let fornecedorToken;
let supplierCompanyId;
let fornecedorUserId;
const createdProductIds = [];

beforeAll(async () => {
  fornecedorToken = await login('fornecedor@kianda.co.ao');
  const forn = await prisma.user.findUnique({ where: { email: 'fornecedor@kianda.co.ao' } });
  supplierCompanyId = forn.companyId;
  fornecedorUserId = forn.id;
});

afterAll(async () => {
  for (const id of createdProductIds) {
    await prisma.productImage.deleteMany({ where: { productId: id } });
    await prisma.productDocument.deleteMany({ where: { productId: id } });
    await prisma.stockMovement.deleteMany({ where: { productId: id } });
    await prisma.notification.deleteMany({ where: { relatedEntityType: 'Product', relatedEntityId: id } });
  }
  await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
  await prisma.$disconnect();
});

describe('req.user.companyPlan', () => {
  test('GET /api/auth/me devolve o plano da empresa', async () => {
    const res = await auth(fornecedorToken).get('/api/auth/me');
    expect(res.status).toBe(200);
    // Empresa "Kianda" semeada em CORE (ver prisma/seed.demo.js).
    expect(res.body.user.companyPlan).toBe('CORE');
  });
});

describe('Editar produto publicado — media', () => {
  let productId;

  beforeAll(async () => {
    const res = await auth(fornecedorToken).post('/api/catalog')
      .field('name', 'Item para editar media')
      .field('category', 'Materiais')
      .field('unitPrice', '1000')
      .attach('mainImage', PNG, 'principal.png')
      .attach('gallery', PNG, 'g1.png')
      .attach('FICHA_TECNICA', PDF, 'ficha.pdf');
    expect(res.status).toBe(201);
    productId = res.body.id;
    createdProductIds.push(productId);
  });

  test('PUT /:id atualiza campos de texto/preço (endpoint já existia, agora ligado à interface)', async () => {
    const res = await auth(fornecedorToken).put(`/api/catalog/${productId}`).send({ name: 'Item editado', unitPrice: 2000 });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Item editado');
    expect(Number(res.body.unitPrice)).toBe(2000);
  });

  test('POST /:id/media acrescenta à galeria e a documentos existentes', async () => {
    const res = await auth(fornecedorToken).post(`/api/catalog/${productId}/media`)
      .attach('gallery', PNG, 'g2.png')
      .attach('CERTIFICADO', PDF, 'cert.pdf');
    expect(res.status).toBe(200);
    // principal + g1 + g2
    expect(res.body.images.length).toBe(3);
    // ficha técnica + certificado
    expect(res.body.documents.length).toBe(2);
  });

  test('POST /:id/media respeita o limite do plano (CORE = 3 documentos por item)', async () => {
    // já tem 2 documentos; CORE permite 3 no total — este ainda cabe.
    const noLimite = await auth(fornecedorToken).post(`/api/catalog/${productId}/media`).attach('CATALOGO', PDF, 'cat.pdf');
    expect(noLimite.status).toBe(200);
    expect(noLimite.body.documents.length).toBe(3);

    // o quarto já excede — rejeitado.
    const excedente = await auth(fornecedorToken).post(`/api/catalog/${productId}/media`).attach('DATASHEET', PDF, 'ds.pdf');
    expect(excedente.status).toBe(400);
    const depois = await auth(fornecedorToken).get(`/api/catalog/${productId}`);
    expect(depois.body.documents.length).toBe(3); // nada foi acrescentado
  });

  test('DELETE /:id/images/:imageId remove e promove a próxima principal', async () => {
    const antes = await auth(fornecedorToken).get(`/api/catalog/${productId}`);
    const principal = antes.body.images.find((i) => i.isPrimary);
    const outra = antes.body.images.find((i) => !i.isPrimary);
    expect(principal).toBeTruthy();
    expect(outra).toBeTruthy();

    const res = await auth(fornecedorToken).del(`/api/catalog/${productId}/images/${principal.id}`);
    expect(res.status).toBe(200);

    const depois = await auth(fornecedorToken).get(`/api/catalog/${productId}`);
    expect(depois.body.images.find((i) => i.id === principal.id)).toBeUndefined();
    expect(depois.body.images.find((i) => i.id === outra.id).isPrimary).toBe(true);
    expect(depois.body.imageUrl).toBe(outra.url);
  });

  test('DELETE /:id/documents/:docId remove', async () => {
    const antes = await auth(fornecedorToken).get(`/api/catalog/${productId}`);
    const doc = antes.body.documents[0];
    const res = await auth(fornecedorToken).del(`/api/catalog/${productId}/documents/${doc.id}`);
    expect(res.status).toBe(200);
    const depois = await auth(fornecedorToken).get(`/api/catalog/${productId}`);
    expect(depois.body.documents.find((d) => d.id === doc.id)).toBeUndefined();
    expect(depois.body.documents.length).toBe(2);
  });

  test('POST /:id/image (trocar foto de capa) mantém a galeria em sincronia', async () => {
    const antes = await auth(fornecedorToken).get(`/api/catalog/${productId}`);
    const totalAntes = antes.body.images.length;

    const res = await auth(fornecedorToken).post(`/api/catalog/${productId}/image`).attach('image', PNG, 'nova-capa.png');
    expect(res.status).toBe(200);

    const depois = await auth(fornecedorToken).get(`/api/catalog/${productId}`);
    const novaPrincipal = depois.body.images.find((i) => i.isPrimary);
    expect(novaPrincipal).toBeTruthy();
    expect(novaPrincipal.url).toBe(depois.body.imageUrl);
    // a foto antiga não desapareceu — passou a fazer parte da galeria.
    expect(depois.body.images.length).toBe(totalAntes + 1);
    expect(depois.body.images.filter((i) => i.isPrimary)).toHaveLength(1);
  });
});

describe('Auditoria das ações de catálogo pelo painel', () => {
  let productId;

  test('criar produto regista CATALOGO_PRODUTO_CRIADO', async () => {
    const res = await auth(fornecedorToken).post('/api/catalog')
      .field('name', 'Item auditado')
      .field('category', 'Materiais')
      .field('unitPrice', '500');
    expect(res.status).toBe(201);
    productId = res.body.id;
    createdProductIds.push(productId);

    const log = await prisma.auditLog.findFirst({ where: { action: 'CATALOGO_PRODUTO_CRIADO', entityId: productId } });
    expect(log).toBeTruthy();
    expect(log.entityRef).toBe('Item auditado');
    expect(log.actorId).toBe(fornecedorUserId);
  });

  test('editar produto regista CATALOGO_PRODUTO_ATUALIZADO', async () => {
    await auth(fornecedorToken).put(`/api/catalog/${productId}`).send({ unitPrice: 900 });
    const log = await prisma.auditLog.findFirst({ where: { action: 'CATALOGO_PRODUTO_ATUALIZADO', entityId: productId } });
    expect(log).toBeTruthy();
    expect(log.detail.camposAlterados).toContain('unitPrice');
  });

  test('atualizar stock regista CATALOGO_STOCK_ATUALIZADO', async () => {
    await auth(fornecedorToken).patch(`/api/catalog/${productId}/stock`).send({ stockQuantity: 20 });
    const log = await prisma.auditLog.findFirst({ where: { action: 'CATALOGO_STOCK_ATUALIZADO', entityId: productId } });
    expect(log).toBeTruthy();
  });

  test('criar movimento de stock regista CATALOGO_MOVIMENTO_CRIADO', async () => {
    const res = await auth(fornecedorToken).post('/api/catalog/movements').send({ productId, type: 'ENTRADA', quantity: 3 });
    expect(res.status).toBe(201);
    const log = await prisma.auditLog.findFirst({ where: { action: 'CATALOGO_MOVIMENTO_CRIADO', entityId: res.body.id } });
    expect(log).toBeTruthy();
    expect(log.detail.produtoId).toBe(productId);
  });

  test('desativar produto regista CATALOGO_PRODUTO_REMOVIDO', async () => {
    await auth(fornecedorToken).del(`/api/catalog/${productId}`);
    const log = await prisma.auditLog.findFirst({ where: { action: 'CATALOGO_PRODUTO_REMOVIDO', entityId: productId } });
    expect(log).toBeTruthy();
  });
});

describe('Notificação de stock baixo (só na transição)', () => {
  let productId;

  beforeEach(async () => {
    const prod = await prisma.product.create({
      data: { supplierId: supplierCompanyId, name: 'Item de stock baixo', category: 'Materiais', unitPrice: 100, stockQuantity: 10, minStock: 5 },
    });
    productId = prod.id;
    createdProductIds.push(productId);
  });

  test('cruzar o limiar por movimento de stock gera ESTOQUE_BAIXO', async () => {
    const res = await auth(fornecedorToken).post('/api/catalog/movements').send({ productId, type: 'SAIDA', quantity: 6 }); // 10 -> 4
    expect(res.status).toBe(201);
    const notifs = await prisma.notification.findMany({ where: { type: 'ESTOQUE_BAIXO', relatedEntityId: productId } });
    expect(notifs).toHaveLength(1);
    expect(notifs[0].userId).toBe(fornecedorUserId);
  });

  test('permanecer abaixo do limiar num segundo movimento não repete a notificação', async () => {
    await auth(fornecedorToken).post('/api/catalog/movements').send({ productId, type: 'SAIDA', quantity: 6 }); // 10 -> 4 (cruza)
    await auth(fornecedorToken).post('/api/catalog/movements').send({ productId, type: 'SAIDA', quantity: 1 }); // 4 -> 3 (continua abaixo)
    const notifs = await prisma.notification.findMany({ where: { type: 'ESTOQUE_BAIXO', relatedEntityId: productId } });
    expect(notifs).toHaveLength(1);
  });

  test('sem minStock definido, nenhuma notificação', async () => {
    const semMinimo = await prisma.product.create({
      data: { supplierId: supplierCompanyId, name: 'Item sem minimo de stock', category: 'Materiais', unitPrice: 100, stockQuantity: 10 },
    });
    createdProductIds.push(semMinimo.id);
    await auth(fornecedorToken).post('/api/catalog/movements').send({ productId: semMinimo.id, type: 'SAIDA', quantity: 9 });
    const notifs = await prisma.notification.findMany({ where: { type: 'ESTOQUE_BAIXO', relatedEntityId: semMinimo.id } });
    expect(notifs).toHaveLength(0);
  });

  test('cruzar o limiar via PATCH /:id/stock também notifica', async () => {
    const res = await auth(fornecedorToken).patch(`/api/catalog/${productId}/stock`).send({ stockQuantity: 2 }); // 10 -> 2, abaixo do mínimo 5
    expect(res.status).toBe(200);
    const notifs = await prisma.notification.findMany({ where: { type: 'ESTOQUE_BAIXO', relatedEntityId: productId } });
    expect(notifs).toHaveLength(1);
  });
});
