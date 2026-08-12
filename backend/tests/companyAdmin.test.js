// tests/companyAdmin.test.js
// Telas do Company Admin (Dashboard, Organização, Atividades, Relatórios,
// Configurações) — agregações de leitura + persistência de preferências.
const { auth, prisma, login } = require('./helpers');

let adminToken, compradorToken;
beforeAll(async () => {
  adminToken = await login('admin@petroangola.co.ao');
  compradorToken = await login('comprador@petroangola.co.ao');
});
afterAll(async () => { await prisma.$disconnect(); });

describe('Company Admin — telas agregadas', () => {
  test('Dashboard: KPIs, volume (6 meses) e atividade recente', async () => {
    const res = await auth(adminToken).get('/api/company-admin/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.kpis).toHaveProperty('pedidos');
    expect(res.body.volume.length).toBe(6);
    expect(res.body.resumo).toHaveProperty('usuariosAtivos');
    expect(Array.isArray(res.body.recent)).toBe(true);
  });

  test('Organização: empresa e resumo com contagens', async () => {
    const res = await auth(adminToken).get('/api/company-admin/organizacao');
    expect(res.status).toBe(200);
    expect(res.body.company).toHaveProperty('name');
    expect(res.body.summary).toHaveProperty('users');
  });

  test('Organização (Perfil da Empresa): só o Company Admin — nem Vendedor nem Comprador', async () => {
    // O Perfil da Empresa é a tela do Company Admin. Dentro da empresa mais
    // ninguém lhe acede; cada persona vê a empresa em que está no seu perfil
    // pessoal (/api/users/profile), que só a identifica.
    const fornecedorToken = await login('fornecedor@kianda.co.ao');
    const res = await auth(fornecedorToken).get('/api/company-admin/organizacao');
    expect(res.status).toBe(403);

    const dash = await auth(fornecedorToken).get('/api/company-admin/dashboard');
    expect(dash.status).toBe(403);

    const buyer = await auth(compradorToken).get('/api/company-admin/organizacao');
    expect(buyer.status).toBe(403);
  });

  test('Atividades: KPIs e itens derivados das POs', async () => {
    const res = await auth(adminToken).get('/api/company-admin/activities');
    expect(res.status).toBe(200);
    expect(res.body.kpis).toHaveProperty('total');
    expect(res.body.items.every((i) => i.title && i.status)).toBe(true);
  });

  test('Relatórios: séries de 6 meses e catálogo de relatórios', async () => {
    const res = await auth(adminToken).get('/api/company-admin/reports');
    expect(res.status).toBe(200);
    expect(res.body.series.length).toBe(6);
    expect(res.body.catalog.length).toBeGreaterThan(0);
  });

  test('Configurações: obter e guardar preferências', async () => {
    const get = await auth(adminToken).get('/api/company-admin/settings');
    expect(get.status).toBe(200);
    expect(get.body).toHaveProperty('aprovacaoObrigatoria');
    const put = await auth(adminToken).put('/api/company-admin/settings').send({ valoresSemImpostos: true });
    expect(put.status).toBe(200);
    expect(put.body.valoresSemImpostos).toBe(true);
  });

  test('um comprador não acede às telas do Company Admin (403)', async () => {
    const res = await auth(compradorToken).get('/api/company-admin/dashboard');
    expect(res.status).toBe(403);
  });
});
