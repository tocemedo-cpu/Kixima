// tests/invites.test.js
// Convites de utilizadores: o Company Admin gera links por perfil, o convidado
// preenche o cadastro (conta inativa) e o Company Admin aceita.
const bcrypt = require('bcryptjs');
const { request, app, prisma, auth, login, PASSWORD } = require('./helpers');

const S = 'inv';
const compradorEmail = `comprador.${S}@equipa.co.ao`;
const vendedorEmail = `vendedor.${S}@equipa.co.ao`;
const rejeitadoEmail = `rejeitado.${S}@equipa.co.ao`;
const supplierAdminEmail = `admin.forn.${S}@kianda.co.ao`;
const NEW_PW = 'SenhaNova1';

let clientAdminToken;
let supplierAdminToken;
let supplierAdminId;

beforeAll(async () => {
  clientAdminToken = await login('admin@petroangola.co.ao');

  // O seed não traz Company Admin para a fornecedora — cria-se um para testar o
  // convite de Vendedor (FORNECEDOR).
  const supplier = await prisma.company.findFirst({ where: { type: 'FORNECEDOR' } });
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const admin = await prisma.user.create({
    data: { name: 'Admin Fornecedora', email: supplierAdminEmail, passwordHash, role: 'COMPANY_ADMIN', companyId: supplier.id },
  });
  supplierAdminId = admin.id;
  supplierAdminToken = await login(supplierAdminEmail);
});

afterAll(async () => {
  const emails = [compradorEmail, vendedorEmail, rejeitadoEmail, supplierAdminEmail];
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
  await prisma.$disconnect();
});

describe('Convites de utilizadores', () => {
  test('cliente convida Comprador e o convidado cria a conta (inativa) → admin aceita → login funciona', async () => {
    // 1. Company Admin gera o convite.
    const inviteRes = await auth(clientAdminToken).post('/api/companies/invites').send({ role: 'COMPRADOR' });
    expect(inviteRes.status).toBe(201);
    const { token } = inviteRes.body;
    expect(typeof token).toBe('string');

    // 2. Resolução pública do convite.
    const resolved = await request(app).get(`/api/companies/invite/${token}`);
    expect(resolved.status).toBe(200);
    expect(resolved.body.role).toBe('COMPRADOR');
    expect(resolved.body.companyName).toBeTruthy();

    // 3. Convidado preenche o cadastro (conta fica inativa).
    const accept = await request(app)
      .post(`/api/companies/invite/${token}/accept`)
      .send({ name: 'Novo Comprador', email: compradorEmail, password: NEW_PW });
    expect(accept.status).toBe(201);
    expect(accept.body.active).toBe(false);
    expect(accept.body.passwordHash).toBeUndefined();

    // 4. Antes da aprovação o login é barrado (403 — aguarda aprovação).
    const before = await request(app).post('/api/auth/login').send({ email: compradorEmail, password: NEW_PW });
    expect(before.status).toBe(403);

    // 5. O utilizador aparece na lista da empresa como pendente.
    const listPending = await auth(clientAdminToken).get('/api/companies/users');
    expect(listPending.status).toBe(200);
    const pending = listPending.body.find((u) => u.email === compradorEmail);
    expect(pending).toBeTruthy();
    expect(pending.active).toBe(false);

    // 6. Company Admin aceita o cadastro.
    const activate = await auth(clientAdminToken).patch(`/api/companies/users/${pending.id}/activate`);
    expect(activate.status).toBe(200);
    expect(activate.body.active).toBe(true);

    // 7. Agora o login funciona.
    const after = await request(app).post('/api/auth/login').send({ email: compradorEmail, password: NEW_PW });
    expect(after.status).toBe(200);
    expect(typeof after.body.token).toBe('string');
  });

  test('cliente não pode convidar Vendedor (FORNECEDOR) → 400', async () => {
    const res = await auth(clientAdminToken).post('/api/companies/invites').send({ role: 'FORNECEDOR' });
    expect(res.status).toBe(400);
  });

  test('fornecedora pode convidar Vendedor (FORNECEDOR) → 201', async () => {
    const res = await auth(supplierAdminToken).post('/api/companies/invites').send({ role: 'FORNECEDOR' });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('FORNECEDOR');

    // O convidado consegue criar a conta como Vendedor.
    const accept = await request(app)
      .post(`/api/companies/invite/${res.body.token}/accept`)
      .send({ name: 'Novo Vendedor', email: vendedorEmail, password: NEW_PW });
    expect(accept.status).toBe(201);
    expect(accept.body.role).toBe('FORNECEDOR');
    expect(accept.body.active).toBe(false);
  });

  test('convite inválido → 401', async () => {
    const res = await request(app).get('/api/companies/invite/token-invalido');
    expect(res.status).toBe(401);
  });

  test('Company Admin recusa (remove) um cadastro pendente → 200 e o utilizador desaparece', async () => {
    const invite = await auth(clientAdminToken).post('/api/companies/invites').send({ role: 'FINANCEIRO' });
    await request(app)
      .post(`/api/companies/invite/${invite.body.token}/accept`)
      .send({ name: 'A Recusar', email: rejeitadoEmail, password: NEW_PW });

    const list = await auth(clientAdminToken).get('/api/companies/users');
    const target = list.body.find((u) => u.email === rejeitadoEmail);
    expect(target).toBeTruthy();

    const del = await auth(clientAdminToken).del(`/api/companies/users/${target.id}`);
    expect(del.status).toBe(200);

    const after = await auth(clientAdminToken).get('/api/companies/users');
    expect(after.body.find((u) => u.email === rejeitadoEmail)).toBeFalsy();
  });

  test('não é possível remover o Company Admin → 400', async () => {
    const res = await auth(supplierAdminToken).del(`/api/companies/users/${supplierAdminId}`);
    expect(res.status).toBe(400);
  });

  test('um Comprador não pode gerar convites (403)', async () => {
    const compradorToken = await login('comprador@petroangola.co.ao');
    const res = await auth(compradorToken).post('/api/companies/invites').send({ role: 'COMPRADOR' });
    expect(res.status).toBe(403);
  });
});
