// tests/access-control.test.js
// Regressão de controlo de acesso multi-tenant (IDOR / OWASP A01): um
// utilizador de uma empresa não pode ler Ordens de Compra, Contratos nem o
// perfil de OUTRA empresa. O Admin do Sistema mantém acesso global.
const bcrypt = require('bcryptjs');
const { request, app, prisma, auth, login, PASSWORD } = require('./helpers');

let outsiderToken;      // COMPANY_ADMIN de uma 3.ª empresa, sem relação com os dados
let outsiderCompanyId;
let clientCompanyId;    // Petro Angola (cliente do seed)
let supplierCompanyId;  // Kianda (fornecedor do seed)
let poId;

const OUTSIDER_EMAIL = 'admin.outsider@terceira.co.ao';

beforeAll(async () => {
  const client = await prisma.company.findFirst({ where: { type: 'CLIENTE' } });
  const supplier = await prisma.company.findFirst({ where: { type: 'FORNECEDOR' } });
  clientCompanyId = client.id;
  supplierCompanyId = supplier.id;

  // 3.ª empresa APROVADA + um COMPANY_ADMIN ativo, totalmente alheio aos dados.
  const outsider = await prisma.company.create({
    data: {
      name: 'Terceira Empresa Lda', taxId: `TAX-OUT-${Date.now()}`, type: 'CLIENTE',
      status: 'APROVADA', contactEmail: 'geral@terceira.co.ao',
    },
  });
  outsiderCompanyId = outsider.id;
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  await prisma.user.create({
    data: { name: 'Admin Terceira', email: OUTSIDER_EMAIL, passwordHash, role: 'COMPANY_ADMIN', companyId: outsider.id, active: true },
  });
  outsiderToken = await login(OUTSIDER_EMAIL);

  // Uma PO existente entre cliente e fornecedor (criada pelo seed).
  const po = await prisma.purchaseOrder.findFirst({ where: { buyerCompanyId: clientCompanyId } });
  poId = po?.id ?? null;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: OUTSIDER_EMAIL } });
  await prisma.company.deleteMany({ where: { id: outsiderCompanyId } });
  await prisma.$disconnect();
});

describe('Controlo de acesso multi-tenant (IDOR)', () => {
  test('não pode ler o perfil de outra empresa (403)', async () => {
    const res = await auth(outsiderToken).get(`/api/companies/${clientCompanyId}`);
    expect(res.status).toBe(403);
  });

  test('pode ler o perfil da PRÓPRIA empresa (200)', async () => {
    const res = await auth(outsiderToken).get(`/api/companies/${outsiderCompanyId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(outsiderCompanyId);
  });

  test('não pode ler uma Ordem de Compra de outras empresas (404)', async () => {
    if (!poId) return; // sem PO no seed — nada a testar
    const res = await auth(outsiderToken).get(`/api/purchase-orders/${poId}`);
    expect(res.status).toBe(404);
  });

  test('uma empresa envolvida na PO continua a poder lê-la (200)', async () => {
    if (!poId) return;
    const clientAdmin = await login('admin@petroangola.co.ao');
    const res = await auth(clientAdmin).get(`/api/purchase-orders/${poId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(poId);
  });

  test('o Admin do Sistema mantém acesso global ao perfil de qualquer empresa (200)', async () => {
    const adminSistema = await login('admin@kixima.co.ao');
    const res = await auth(adminSistema).get(`/api/companies/${clientCompanyId}`);
    expect(res.status).toBe(200);
  });
});
