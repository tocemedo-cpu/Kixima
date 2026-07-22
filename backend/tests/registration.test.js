// tests/registration.test.js
// Onboarding público de empresas: conta de administrador (com senha), documentos
// de credenciamento obrigatórios por tipo e apólice de seguro Fornecedor→KIXIMA.
const { request, app, prisma, login } = require('./helpers');

// PDF mínimo válido, reutilizado como conteúdo de qualquer documento anexado.
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');

// Sufixo único para não colidir com o seed nem entre execuções da suite.
const S = 'reg';
const clienteTax = `NIF-CLI-${S}`;
const fornTax = `NIF-FOR-${S}`;
const clienteAdmin = `admin.cli.${S}@empresa.co.ao`;
const fornAdmin = `admin.for.${S}@empresa.co.ao`;
const PW = 'SenhaForte1';

// Limpa tudo o que a suite cria — mantém a base partilhada estável e a ordem
// dos ficheiros de teste irrelevante.
afterAll(async () => {
  const emails = [clienteAdmin, fornAdmin];
  const taxIds = [clienteTax, fornTax];
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
  const companies = await prisma.company.findMany({ where: { taxId: { in: taxIds } } });
  const ids = companies.map((c) => c.id);
  if (ids.length) {
    await prisma.supplierToKiximaPolicy.deleteMany({ where: { companyId: { in: ids } } });
    await prisma.companyDocument.deleteMany({ where: { companyId: { in: ids } } });
    await prisma.company.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.$disconnect();
});

describe('Cadastro de empresas (onboarding)', () => {
  test('cliente: cadastra com documentos e cria conta de administrador com senha', async () => {
    const res = await request(app)
      .post('/api/companies/register')
      .field('type', 'CLIENTE')
      .field('name', 'Operadora Teste Reg')
      .field('taxId', clienteTax)
      .field('contactEmail', `contacto.cli.${S}@empresa.co.ao`)
      .field('adminName', 'Admin Cliente')
      .field('adminEmail', clienteAdmin)
      .field('adminPassword', PW)
      .attach('CERTIDAO_COMERCIAL', PDF, 'certidao.pdf')
      .attach('ALVARA_COMERCIAL', PDF, 'alvara.pdf');

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDENTE');
    expect(res.body.type).toBe('CLIENTE');
  });

  test('cliente: falta um documento obrigatório → 400', async () => {
    const res = await request(app)
      .post('/api/companies/register')
      .field('type', 'CLIENTE')
      .field('name', 'Operadora Sem Doc')
      .field('taxId', `${clienteTax}-x`)
      .field('contactEmail', `x.${S}@empresa.co.ao`)
      .field('adminName', 'Admin X')
      .field('adminEmail', `x.admin.${S}@empresa.co.ao`)
      .field('adminPassword', PW)
      .attach('CERTIDAO_COMERCIAL', PDF, 'certidao.pdf'); // falta ALVARA_COMERCIAL

    expect(res.status).toBe(400);
  });

  test('fornecedor: sem apólice → 400', async () => {
    const res = await request(app)
      .post('/api/companies/register')
      .field('type', 'FORNECEDOR')
      .field('name', 'Fornecedora Sem Apolice')
      .field('taxId', `${fornTax}-x`)
      .field('contactEmail', `fx.${S}@empresa.co.ao`)
      .field('adminName', 'Admin FX')
      .field('adminEmail', `fx.admin.${S}@empresa.co.ao`)
      .field('adminPassword', PW)
      .attach('ALVARA_COMERCIAL', PDF, 'alvara.pdf')
      .attach('LICENCA_ANPG', PDF, 'anpg.pdf')
      .attach('CERTIDAO_COMERCIAL', PDF, 'certidao.pdf');
    // Sem campos da apólice nem documento APOLICE_SEGURO.

    expect(res.status).toBe(400);
  });

  test('fornecedor: cadastra com documentos + apólice, o admin aprova e o login funciona', async () => {
    const res = await request(app)
      .post('/api/companies/register')
      .field('type', 'FORNECEDOR')
      .field('name', 'Fornecedora Teste Reg')
      .field('taxId', fornTax)
      .field('contactEmail', `contacto.for.${S}@empresa.co.ao`)
      .field('adminName', 'Admin Fornecedor')
      .field('adminEmail', fornAdmin)
      .field('adminPassword', PW)
      .field('insurer', 'Seguradora Angola')
      .field('policyNumber', 'AP-2026-001')
      .field('coverageAmount', '50000000')
      .field('policyCurrency', 'AOA')
      .field('policyValidFrom', '2026-01-01')
      .field('policyValidUntil', '2026-12-31')
      .attach('ALVARA_COMERCIAL', PDF, 'alvara.pdf')
      .attach('LICENCA_ANPG', PDF, 'anpg.pdf')
      .attach('CERTIDAO_COMERCIAL', PDF, 'certidao.pdf')
      .attach('APOLICE_SEGURO', PDF, 'apolice.pdf');

    expect(res.status).toBe(201);
    const companyId = res.body.id;

    // A apólice foi criada com o documento anexado.
    const policy = await prisma.supplierToKiximaPolicy.findFirst({ where: { companyId } });
    expect(policy).toBeTruthy();
    expect(policy.policyNumber).toBe('AP-2026-001');
    expect(policy.documentUrl).toBeTruthy();

    // Antes da aprovação, o login é barrado (empresa não aprovada).
    const before = await request(app).post('/api/auth/login').send({ email: fornAdmin, password: PW });
    expect(before.status).toBe(403);

    // Admin do Sistema aprova a empresa.
    const adminToken = await login('admin@kixima.co.ao');
    const decide = await request(app)
      .patch(`/api/companies/${companyId}/decision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ approve: true });
    expect(decide.status).toBe(200);
    expect(decide.body.status).toBe('APROVADA');

    // Depois da aprovação, o admin da empresa entra com a senha do cadastro.
    const after = await request(app).post('/api/auth/login').send({ email: fornAdmin, password: PW });
    expect(after.status).toBe(200);
    expect(typeof after.body.token).toBe('string');
  });

  test('NIF duplicado → 409', async () => {
    const res = await request(app)
      .post('/api/companies/register')
      .field('type', 'CLIENTE')
      .field('name', 'Duplicada')
      .field('taxId', clienteTax) // já usado no primeiro teste
      .field('contactEmail', `dup.${S}@empresa.co.ao`)
      .field('adminName', 'Admin Dup')
      .field('adminEmail', `dup.admin.${S}@empresa.co.ao`)
      .field('adminPassword', PW)
      .attach('CERTIDAO_COMERCIAL', PDF, 'certidao.pdf')
      .attach('ALVARA_COMERCIAL', PDF, 'alvara.pdf');

    expect(res.status).toBe(409);
  });
});
