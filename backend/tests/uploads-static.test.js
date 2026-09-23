// tests/uploads-static.test.js
// /api/uploads/:filename deixou de ser express.static: cada pedido passa por
// uploadAccessService, que só serve (a) ficheiros públicos (fotos de
// catálogo, avatares, imagens de ajuda) a qualquer pedido, com ou sem sessão,
// ou (b) ficheiros privados (documentos, comprovativos, anexos de chat) à
// própria empresa dona ou ao Admin do Sistema. Um ficheiro sem sessão e sem
// registo público na base já não é servido às cegas — era exatamente essa a
// falha (comprovativos e documentos de outras empresas descarregáveis por
// qualquer pessoa que soubesse/adivinhasse o nome do ficheiro).
const fs = require('fs');
const path = require('path');
const { request, auth, login, prisma, app } = require('./helpers');
const { uploadsDir } = require('../src/services/storageService');

describe('GET /api/uploads/:ficheiro', () => {
  const nomePublico = 'teste-uploads-publico-existe.png';
  const caminhoPublico = path.join(uploadsDir, nomePublico);
  // Assinatura PNG real — fileSignature.detetar só reconhece Content-Type a
  // partir do conteúdo, não da extensão.
  const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

  let productId;
  let adminToken;

  beforeAll(async () => {
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(caminhoPublico, PNG);

    adminToken = await login('admin@kixima.co.ao');
    const fornecedor = await prisma.user.findUnique({ where: { email: 'fornecedor@kianda.co.ao' } });
    const prod = await prisma.product.create({
      data: {
        supplierId: fornecedor.companyId, name: 'Produto para teste de uploads', category: 'Materiais',
        unitPrice: 1000, imageUrl: `/api/uploads/${nomePublico}`,
      },
    });
    productId = prod.id;
  });

  afterAll(async () => {
    fs.rmSync(caminhoPublico, { force: true });
    if (productId) await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.$disconnect();
  });

  test('ficheiro público (imagem de produto) é servido sem sessão', async () => {
    const res = await request(app).get(`/api/uploads/${nomePublico}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^image\/png/);
  });

  test('ficheiro privado sem sessão devolve 401, não o conteúdo', async () => {
    const res = await request(app).get('/api/uploads/121212-CERTIDAOCOMERCIAL-1784824319068.jpeg');
    expect(res.status).toBe(401);
  });

  test('ficheiro sem registo em nenhuma tabela não é servido nem a um utilizador autenticado comum', async () => {
    const compradorToken = await login('comprador@petroangola.co.ao');
    const res = await auth(compradorToken).get('/api/uploads/121212-CERTIDAOCOMERCIAL-1784824319068.jpeg');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('FILE_NOT_FOUND');
  });

  test('ficheiro perdido (ex.: apagado num reinício) devolve FILE_NOT_FOUND ao Admin do Sistema, não ROUTE_NOT_FOUND', async () => {
    const res = await auth(adminToken).get('/api/uploads/121212-CERTIDAOCOMERCIAL-1784824319068.jpeg');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('FILE_NOT_FOUND');
    expect(res.body.error.message).not.toMatch(/Rota/);
  });

  test('nome de ficheiro forjado (tentativa de path traversal) devolve 404 sem tocar o disco', async () => {
    const res = await auth(adminToken).get('/api/uploads/..%2f..%2fetc%2fpasswd');
    expect(res.status).toBe(404);
  });
});
