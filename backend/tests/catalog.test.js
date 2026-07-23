// tests/catalog.test.js
// Cadastro de produto pelo Vendedor (fornecedor): ficha completa (identificação,
// especificações, preço, estoque) com imagem principal, galeria e documentos.
const { request, app, prisma, login } = require('./helpers');

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');

let fornecedorToken;
let createdId;

beforeAll(async () => {
  fornecedorToken = await login('fornecedor@kianda.co.ao');
});

afterAll(async () => {
  if (createdId) {
    await prisma.productImage.deleteMany({ where: { productId: createdId } });
    await prisma.productDocument.deleteMany({ where: { productId: createdId } });
    await prisma.product.deleteMany({ where: { id: createdId } });
  }
  await prisma.$disconnect();
});

describe('Cadastro de catálogo (ficha completa)', () => {
  test('cria produto com todos os campos, imagem principal, galeria e documentos', async () => {
    const res = await request(app)
      .post('/api/catalog')
      .set('Authorization', `Bearer ${fornecedorToken}`)
      // Identificação
      .field('name', 'Válvula de Esfera 6" API 6D')
      .field('sku', 'VLV-6-API6D')
      .field('manufacturerCode', 'CAM-6D-600')
      .field('category', 'Válvulas')
      .field('subcategory', 'Esfera')
      .field('brand', 'Cameron')
      .field('manufacturer', 'Cameron International')
      .field('model', 'T31')
      .field('countryOfOrigin', 'EUA')
      // Descrição
      .field('description', 'Válvula de esfera flutuante para óleo e gás.')
      .field('fullDescription', 'Corpo em aço carbono, trim inox, classe 600.')
      .field('applications', 'Linhas de processo, manifolds.')
      .field('benefits', 'Vedação bidirecional, baixo torque.')
      .field('keywords', 'valvula, esfera, api 6d, 600')
      // Especificações técnicas
      .field('material', 'Aço carbono A216 WCB')
      .field('weight', '85 kg')
      .field('pressure', '600# (100 bar)')
      .field('temperature', '-29°C a 120°C')
      .field('measurementUnit', 'unidade')
      // Preço
      .field('unitPrice', '1250000')
      .field('promoPrice', '1120000')
      .field('currency', 'AOA')
      .field('minQuantity', '1')
      .field('maxQuantity', '50')
      // Estoque
      .field('stockQuantity', '12')
      .field('warehouse', 'Luanda — Zona Industrial')
      .field('leadTimeDays', '15')
      .field('availability', 'Em stock')
      .field('minStock', '3')
      // Media
      .attach('mainImage', PNG, 'principal.png')
      .attach('gallery', PNG, 'g1.png')
      .attach('gallery', PNG, 'g2.png')
      .attach('FICHA_TECNICA', PDF, 'ficha.pdf')
      .attach('CERTIFICADO', PDF, 'cert1.pdf')
      .attach('CERTIFICADO', PDF, 'cert2.pdf');

    expect(res.status).toBe(201);
    createdId = res.body.id;
    expect(res.body.sku).toBe('VLV-6-API6D');
    expect(Number(res.body.promoPrice)).toBe(1120000);
    expect(res.body.stockQuantity).toBe(12);
    expect(res.body.imageUrl).toBeTruthy(); // principal reflete no marketplace
    // 1 principal + 2 galeria
    expect(res.body.images).toHaveLength(3);
    expect(res.body.images.filter((i) => i.isPrimary)).toHaveLength(1);
    // 1 ficha técnica + 2 certificados
    expect(res.body.documents).toHaveLength(3);

    // getProduct traz imagens e documentos ordenados.
    const detail = await request(app).get(`/api/catalog/${createdId}`).set('Authorization', `Bearer ${fornecedorToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.images.length).toBe(3);
    expect(detail.body.documents.some((d) => d.type === 'FICHA_TECNICA')).toBe(true);
  });

  test('rejeita produto sem nome (422)', async () => {
    const res = await request(app)
      .post('/api/catalog')
      .set('Authorization', `Bearer ${fornecedorToken}`)
      .field('category', 'Válvulas')
      .field('unitPrice', '1000');
    expect(res.status).toBe(422);
  });

  test('sem imagem/documentos também cria (campos de media são opcionais)', async () => {
    const res = await request(app)
      .post('/api/catalog')
      .set('Authorization', `Bearer ${fornecedorToken}`)
      .field('name', 'Serviço de Inspeção NDT')
      .field('category', 'Inspeção & Ensaios')
      .field('unitPrice', '500000');
    expect(res.status).toBe(201);
    expect(res.body.images).toHaveLength(0);
    // limpeza
    await prisma.product.deleteMany({ where: { id: res.body.id } });
  });
});
