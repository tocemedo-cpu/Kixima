// tests/supplier-dev-approve.test.js
// Antes desta funcionalidade, a candidatura ao Supplier Development não
// concedia nenhuma conta: uma vez "concluída", a empresa aprovada não tinha
// forma de entrar na plataforma. Aprovar uma candidatura sem empresa
// associada tem agora de: criar a Company (Fornecedor, PENDENTE), a apólice
// Fornecedor→KIXIMA (exigida na due diligence) e convidar o contacto a
// definir a senha do primeiro Company Admin — que nasce ATIVO (não há
// nenhum outro Company Admin para o aprovar).
const { request, app, prisma, auth, loginAll } = require('./helpers');

const S = 'sdaprov';

let tokens;
let reference;
let requestId;

const POLICY = {
  insurer: 'Seguradora Angolana de Garantias',
  policyNumber: `POL-${S}-001`,
  coverageAmount: 50000,
  currency: 'AOA',
  validFrom: '2026-01-01',
  validUntil: '2027-01-01',
};

beforeAll(async () => {
  tokens = await loginAll();
});

afterAll(async () => {
  const emails = [`joana.${S}@novaempresa.co.ao`];
  await prisma.employeeInvite.deleteMany({ where: { email: { in: emails } } });
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
  const empresas = await prisma.company.findMany({ where: { taxId: { startsWith: `NIF-${S}` } } });
  const ids = empresas.map((c) => c.id);
  await prisma.supplierToKiximaPolicy.deleteMany({ where: { companyId: { in: ids } } });
  await prisma.supplierDevRequest.updateMany({ where: { companyId: { in: ids } }, data: { companyId: null } });
  await prisma.company.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

describe('Aprovar candidatura de Supplier Development sem empresa associada', () => {
  test('candidatura pública, sem NIF', async () => {
    const res = await request(app)
      .post('/api/supplier-development/requests')
      .send({
        companyName: `Nova Empresa ${S}, Lda`,
        contactName: 'Joana Neto',
        contactEmail: `joana.${S}@novaempresa.co.ao`,
        province: 'Luanda',
        sector: 'Logística',
        employees: 8,
        track: 'BUROCRACIA',
        needs: 'Apoio no licenciamento.',
        feeAccepted: true,
      });
    expect(res.status).toBe(201);
    reference = res.body.reference;
  });

  test('PATCH genérico já não aceita status CONCLUIDA (422) — evita "concluir" sem criar conta', async () => {
    const lista = await auth(tokens.adminSistema).get('/api/supplier-development/requests');
    requestId = lista.body.items.find((r) => r.reference === reference).id;
    const res = await auth(tokens.adminSistema)
      .patch(`/api/supplier-development/requests/${requestId}`)
      .send({ status: 'CONCLUIDA' });
    expect(res.status).toBe(422);
  });

  test('aprovar sem NIF (nem na candidatura, nem no pedido) → 422', async () => {
    const res = await auth(tokens.adminSistema)
      .patch(`/api/supplier-development/requests/${requestId}/approve`)
      .send({ policy: POLICY });
    expect(res.status).toBe(422);
  });

  test('só o Admin do Sistema pode aprovar', async () => {
    const res = await auth(tokens.comprador)
      .patch(`/api/supplier-development/requests/${requestId}/approve`)
      .send({ taxId: `NIF-${S}-001`, policy: POLICY });
    expect(res.status).toBe(403);
  });

  test('aprovar cria a empresa (Fornecedor, PENDENTE), a apólice e convida o contacto', async () => {
    const res = await auth(tokens.adminSistema)
      .patch(`/api/supplier-development/requests/${requestId}/approve`)
      .send({ taxId: `NIF-${S}-001`, policy: POLICY });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CONCLUIDA');
    expect(res.body.companyId).toBeTruthy();

    const company = await prisma.company.findUnique({ where: { id: res.body.companyId } });
    expect(company.type).toBe('FORNECEDOR');
    expect(company.status).toBe('PENDENTE');
    expect(company.taxId).toBe(`NIF-${S}-001`);

    const policy = await prisma.supplierToKiximaPolicy.findFirst({ where: { companyId: company.id } });
    expect(policy).toBeTruthy();
    expect(policy.insurer).toBe(POLICY.insurer);

    const invite = await prisma.employeeInvite.findFirst({ where: { companyId: company.id, role: 'COMPANY_ADMIN' } });
    expect(invite).toBeTruthy();
    expect(invite.email).toBe(`joana.${S}@novaempresa.co.ao`);
    expect(invite.status).toBe('PENDENTE');
  });

  test('NIF repetido → conflito', async () => {
    const outra = await request(app)
      .post('/api/supplier-development/requests')
      .send({
        companyName: `Outra Empresa ${S}, Lda`,
        contactName: 'Pedro',
        contactEmail: `pedro.${S}@outra.co.ao`,
        feeAccepted: true,
      });
    const lista = await auth(tokens.adminSistema).get('/api/supplier-development/requests');
    const outraId = lista.body.items.find((r) => r.reference === outra.body.reference).id;
    const res = await auth(tokens.adminSistema)
      .patch(`/api/supplier-development/requests/${outraId}/approve`)
      .send({ taxId: `NIF-${S}-001`, policy: POLICY });
    expect(res.status).toBe(409);
  });

  test('candidatura já concluída não pode ser aprovada outra vez', async () => {
    const res = await auth(tokens.adminSistema)
      .patch(`/api/supplier-development/requests/${requestId}/approve`)
      .send({ taxId: `NIF-${S}-002`, policy: POLICY });
    expect(res.status).toBe(400);
  });

  test('o convite aceite cria o primeiro Company Admin já ATIVO (sem outro admin para o aprovar)', async () => {
    const invite = await prisma.employeeInvite.findFirst({ where: { email: `joana.${S}@novaempresa.co.ao`, role: 'COMPANY_ADMIN' } });
    const resolved = await request(app).get(`/api/companies/invite/${invite.token}`);
    expect(resolved.status).toBe(200);
    expect(resolved.body.role).toBe('COMPANY_ADMIN');
    expect(resolved.body.name).toBe('Joana Neto');

    const accept = await request(app)
      .post(`/api/companies/invite/${invite.token}/accept`)
      .send({ password: 'Bomba-Hidraulica-9', termsAccepted: true });
    expect(accept.status).toBe(201);
    expect(accept.body.role).toBe('COMPANY_ADMIN');
    // Diferença central: um convite de funcionário normal nasce active:false
    // (ver tests/invites.test.js) — este nasce ativo, é o próprio fundador.
    expect(accept.body.active).toBe(true);

    // A conta existe e a senha funciona — mas a empresa ainda não passou pela
    // due diligence do Admin do Sistema, por isso o login continua barrado.
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: `joana.${S}@novaempresa.co.ao`, password: 'Bomba-Hidraulica-9' });
    expect(login.status).toBe(403);
  });
});
