// tests/profile.test.js
// Perfil pessoal unificado — mesmo formato para todas as personas, com resumo
// adequado ao papel.
const { auth, prisma, login } = require('./helpers');

let comprador, fornecedor, financeiro, admin;
beforeAll(async () => {
  comprador = await login('comprador@petroangola.co.ao');
  fornecedor = await login('fornecedor@kianda.co.ao');
  financeiro = await login('financeiro@petroangola.co.ao');
  admin = await login('admin@kixima.co.ao');
});
afterAll(async () => { await prisma.$disconnect(); });

async function profile(token) {
  const res = await auth(token).get('/api/users/profile');
  expect(res.status).toBe(200);
  return res.body;
}

describe('Perfil pessoal — formato unificado', () => {
  test('comprador tem 4 cartões (lado comprador) + empresa + atividade', async () => {
    const p = await profile(comprador);
    expect(p.kind).toBe('buyer');
    expect(p.cards.length).toBe(4);
    expect(p.cards.map((c) => c.label)).toContain('Valor Total Comprado');
    expect(p.company).toHaveProperty('name');
    expect(p.user).toHaveProperty('avatarUrl');
  });

  test('fornecedor tem o mesmo formato, com resumo de vendas', async () => {
    const p = await profile(fornecedor);
    expect(p.kind).toBe('supplier');
    expect(p.cards.length).toBe(4);
    expect(p.cards.map((c) => c.label)).toContain('Valor Total Vendido');
  });

  test('financeiro tem o mesmo formato (lado comprador da empresa)', async () => {
    const p = await profile(financeiro);
    expect(p.cards.length).toBe(4);
    expect(p.company).toHaveProperty('name');
  });

  test('admin do sistema tem o mesmo formato, com estatísticas da plataforma', async () => {
    const p = await profile(admin);
    expect(p.kind).toBe('admin');
    expect(p.company).toBeNull();
    expect(p.cards.map((c) => c.label)).toContain('Empresas');
  });
});
