// tests/invites.test.js
// Convite de funcionário: o Company Admin informa nome + email, o sistema gera o
// link único e envia automaticamente por email (o admin não copia nada). O
// convite fica com estado (Pendente/Aceito/Expirado/Cancelado) e pode ser
// reenviado ou cancelado. O convidado apenas define a senha.
const bcrypt = require('bcryptjs');
const { request, app, prisma, auth, login, PASSWORD } = require('./helpers');

const S = 'inv';
const compradorEmail = `comprador.${S}@equipa.co.ao`;
const vendedorEmail = `vendedor.${S}@equipa.co.ao`;
const canceladoEmail = `cancelado.${S}@equipa.co.ao`;
const supplierAdminEmail = `admin.forn.${S}@kianda.co.ao`;
// Cumpre a politica: 10+ caracteres, sem sequencias nem senhas de lista.
const NEW_PW = 'Bomba-Hidraulica-7';

let clientAdminToken;
let supplierAdminToken;
let supplierAdminId;

// O token vive na base de dados (e no email) — o admin não o manuseia.
async function tokenOf(inviteId) {
  const inv = await prisma.employeeInvite.findUnique({ where: { id: inviteId } });
  return inv.token;
}

beforeAll(async () => {
  clientAdminToken = await login('admin@petroangola.co.ao');

  const supplier = await prisma.company.findFirst({ where: { type: 'FORNECEDOR' } });
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const admin = await prisma.user.create({
    data: { name: 'Admin Fornecedora', email: supplierAdminEmail, passwordHash, role: 'COMPANY_ADMIN', companyId: supplier.id },
  });
  supplierAdminId = admin.id;
  supplierAdminToken = await login(supplierAdminEmail);
});

afterAll(async () => {
  const emails = [compradorEmail, vendedorEmail, canceladoEmail, supplierAdminEmail];
  await prisma.employeeInvite.deleteMany({ where: { email: { in: emails } } });
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
  await prisma.$disconnect();
});

describe('Convite de funcionário (link gerado e enviado automaticamente)', () => {
  test('admin informa nome+email → convite PENDENTE (sem expor link) → convidado define senha → ACEITO → aprovação → login', async () => {
    // 1. Company Admin cadastra o funcionário com nome + email.
    const inviteRes = await auth(clientAdminToken).post('/api/companies/invites')
      .send({ role: 'COMPRADOR', name: 'Novo Comprador', email: compradorEmail });
    expect(inviteRes.status).toBe(201);
    expect(inviteRes.body.status).toBe('PENDENTE');
    expect(inviteRes.body.email).toBe(compradorEmail);
    // O link/token não é devolvido ao admin — o envio é automático.
    expect(inviteRes.body.token).toBeUndefined();

    // 2. O convite aparece na lista da empresa como Pendente.
    const invites = await auth(clientAdminToken).get('/api/companies/invites');
    expect(invites.status).toBe(200);
    const listed = invites.body.find((i) => i.email === compradorEmail);
    expect(listed.status).toBe('PENDENTE');

    // 3. Resolução pública do convite: já traz nome/email preenchidos.
    const token = await tokenOf(inviteRes.body.id);
    const resolved = await request(app).get(`/api/companies/invite/${token}`);
    expect(resolved.status).toBe(200);
    expect(resolved.body.role).toBe('COMPRADOR');
    expect(resolved.body.name).toBe('Novo Comprador');
    expect(resolved.body.email).toBe(compradorEmail);

    // 4. Convidado apenas define a senha; nome/email vêm do convite.
    const accept = await request(app).post(`/api/companies/invite/${token}/accept`).send({ password: NEW_PW, termsAccepted: true });
    expect(accept.status).toBe(201);
    expect(accept.body.active).toBe(false);
    expect(accept.body.email).toBe(compradorEmail);
    expect(accept.body.passwordHash).toBeUndefined();

    // 5. O convite passa a ACEITO.
    const afterAccept = await auth(clientAdminToken).get('/api/companies/invites');
    expect(afterAccept.body.find((i) => i.email === compradorEmail).status).toBe('ACEITO');

    // 6. Antes da aprovação o login é barrado; depois de aprovado funciona.
    const before = await request(app).post('/api/auth/login').send({ email: compradorEmail, password: NEW_PW });
    expect(before.status).toBe(403);
    const pending = (await auth(clientAdminToken).get('/api/companies/users')).body.find((u) => u.email === compradorEmail);
    await auth(clientAdminToken).patch(`/api/companies/users/${pending.id}/activate`);
    const after = await request(app).post('/api/auth/login').send({ email: compradorEmail, password: NEW_PW });
    expect(after.status).toBe(200);
  });

  test('nome/email em falta → 422 (validação)', async () => {
    const res = await auth(clientAdminToken).post('/api/companies/invites').send({ role: 'COMPRADOR' });
    expect(res.status).toBe(422);
  });

  test('cliente não pode convidar Vendedor (FORNECEDOR) → 400', async () => {
    const res = await auth(clientAdminToken).post('/api/companies/invites')
      .send({ role: 'FORNECEDOR', name: 'Teste Um', email: `x.${S}@equipa.co.ao` });
    expect(res.status).toBe(400);
  });

  test('fornecedora convida Vendedor e o convidado define a senha → 201', async () => {
    const res = await auth(supplierAdminToken).post('/api/companies/invites')
      .send({ role: 'FORNECEDOR', name: 'Novo Vendedor', email: vendedorEmail });
    expect(res.status).toBe(201);
    const token = await tokenOf(res.body.id);
    const accept = await request(app).post(`/api/companies/invite/${token}/accept`).send({ password: NEW_PW, termsAccepted: true });
    expect(accept.status).toBe(201);
    expect(accept.body.role).toBe('FORNECEDOR');
    expect(accept.body.active).toBe(false);
  });

  test('cancelar convite impede a sua aceitação; reenviar volta a permitir', async () => {
    const res = await auth(clientAdminToken).post('/api/companies/invites')
      .send({ role: 'FINANCEIRO', name: 'A Cancelar', email: canceladoEmail });
    const id = res.body.id;

    // Cancelar → estado CANCELADO e a aceitação é recusada.
    const cancel = await auth(clientAdminToken).post(`/api/companies/invites/${id}/cancel`);
    expect(cancel.status).toBe(200);
    expect(cancel.body.status).toBe('CANCELADO');
    const blocked = await request(app).post(`/api/companies/invite/${await tokenOf(id)}/accept`).send({ password: NEW_PW, termsAccepted: true });
    expect(blocked.status).toBeGreaterThanOrEqual(400);

    // Reenviar → novo token, estado PENDENTE, aceitação volta a funcionar.
    const resend = await auth(clientAdminToken).post(`/api/companies/invites/${id}/resend`);
    expect(resend.status).toBe(200);
    expect(resend.body.status).toBe('PENDENTE');
    const accept = await request(app).post(`/api/companies/invite/${await tokenOf(id)}/accept`).send({ password: NEW_PW, termsAccepted: true });
    expect(accept.status).toBe(201);
  });

  test('convite inválido → 401', async () => {
    const res = await request(app).get('/api/companies/invite/token-invalido');
    expect(res.status).toBe(401);
  });

  test('um Comprador não pode gerar convites (403)', async () => {
    const compradorToken = await login('comprador@petroangola.co.ao');
    const res = await auth(compradorToken).post('/api/companies/invites')
      .send({ role: 'COMPRADOR', name: 'Teste Dois', email: `y.${S}@equipa.co.ao` });
    expect(res.status).toBe(403);
  });
});
