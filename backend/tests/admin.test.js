// tests/admin.test.js
// Administração global (Admin do Sistema): Permissões (bloquear/desbloquear
// qualquer perfil) e Gestão de Atividades. Company Admin: permissões da própria
// empresa. Usa um utilizador descartável para não afetar as outras personas.
const bcrypt = require('bcryptjs');
const { auth, prisma, login } = require('./helpers');

let adminToken, caToken, compradorToken, tempId, clientCompanyId;

beforeAll(async () => {
  adminToken = await login('admin@kixima.co.ao');
  caToken = await login('admin@petroangola.co.ao');
  compradorToken = await login('comprador@petroangola.co.ao');
  const comprador = await prisma.user.findUnique({ where: { email: 'comprador@petroangola.co.ao' } });
  clientCompanyId = comprador.companyId;
  const u = await prisma.user.create({
    data: { name: 'Utilizador Temp', email: 'temp.perm@petroangola.co.ao', passwordHash: await bcrypt.hash('x', 10), role: 'COMPRADOR', companyId: clientCompanyId, active: true },
  });
  tempId = u.id;
});
afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: tempId } });
  await prisma.$disconnect();
});

describe('Admin do Sistema — Permissões', () => {
  test('lista todos os utilizadores da plataforma', async () => {
    const res = await auth(adminToken).get('/api/admin/users');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(5);
    expect(res.body[0]).toHaveProperty('active');
  });

  test('bloqueia e desbloqueia qualquer perfil', async () => {
    const block = await auth(adminToken).patch(`/api/admin/users/${tempId}/status`).send({ active: false });
    expect(block.status).toBe(200);
    expect(block.body.active).toBe(false);
    const unblock = await auth(adminToken).patch(`/api/admin/users/${tempId}/status`).send({ active: true });
    expect(unblock.body.active).toBe(true);
  });

  test('não pode bloquear a própria conta (400)', async () => {
    const me = await auth(adminToken).get('/api/users/me');
    const res = await auth(adminToken).patch(`/api/admin/users/${me.body.id}/status`).send({ active: false });
    expect(res.status).toBe(400);
  });

  test('um não-admin não acede à administração (403)', async () => {
    expect((await auth(compradorToken).get('/api/admin/users')).status).toBe(403);
    expect((await auth(compradorToken).get('/api/admin/activities')).status).toBe(403);
  });
});

describe('Admin do Sistema — Gestão de Atividades', () => {
  test('devolve KPIs e feed de todo o sistema', async () => {
    const res = await auth(adminToken).get('/api/admin/activities');
    expect(res.status).toBe(200);
    expect(res.body.kpis).toHaveProperty('empresas');
    expect(res.body.items.length).toBeGreaterThan(0);
    const types = new Set(res.body.items.map((i) => i.type));
    expect(types.has('Ordem de Compra')).toBe(true);
  });
});

describe('Company Admin — Permissões da empresa', () => {
  test('bloqueia/desbloqueia um perfil da sua empresa', async () => {
    const block = await auth(caToken).patch(`/api/companies/users/${tempId}/status`).send({ active: false });
    expect(block.status).toBe(200);
    expect(block.body.active).toBe(false);
    await auth(caToken).patch(`/api/companies/users/${tempId}/status`).send({ active: true });
  });

  test('não pode bloquear o próprio Company Admin', async () => {
    const me = await auth(caToken).get('/api/users/me');
    const res = await auth(caToken).patch(`/api/companies/users/${me.body.id}/status`).send({ active: false });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
