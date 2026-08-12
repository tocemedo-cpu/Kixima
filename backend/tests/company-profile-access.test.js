// tests/company-profile-access.test.js
// A ficha da empresa (Perfil da Empresa) é a tela do COMPANY_ADMIN. Dentro da
// empresa mais ninguém lhe acede — nem o Comprador, nem o Financeiro. Ela reúne
// documentos de credenciamento, apólices, dados bancários, limites de orçamento
// e o plano contratado.
//
// O Admin do Sistema vê a de qualquer empresa (é o que a due diligence exige).
const { loginAll, auth } = require('./helpers');

describe('Acesso à ficha da empresa', () => {
  let tokens;
  let companyId;      // empresa do Company Admin (a mesma do comprador/financeiro)
  let outraEmpresaId; // empresa do fornecedor — serve para o isolamento entre empresas

  beforeAll(async () => {
    tokens = await loginAll();
    companyId = (await auth(tokens.companyAdmin).get('/api/auth/me')).body.user.companyId;
    outraEmpresaId = (await auth(tokens.fornecedor).get('/api/auth/me')).body.user.companyId;
  });

  test('o Company Admin vê a ficha da própria empresa', async () => {
    const res = await auth(tokens.companyAdmin).get(`/api/companies/${companyId}`);
    expect(res.status).toBe(200);
    expect(res.body.taxId).toBeTruthy();
  });

  // Mesma empresa, papéis diferentes: aqui testa-se a restrição por PERFIL.
  test.each(['comprador', 'financeiro'])(
    'o %s da mesma empresa não acede à ficha',
    async (persona) => {
      const res = await auth(tokens[persona]).get(`/api/companies/${companyId}`);
      expect(res.status).toBe(403);
    },
  );

  // O Vendedor está noutra empresa (fornecedora) — testa-se com a ficha DELA,
  // para o 403 vir do perfil e não do isolamento entre empresas.
  test('o Vendedor não acede à ficha da própria empresa', async () => {
    const res = await auth(tokens.fornecedor).get(`/api/companies/${outraEmpresaId}`);
    expect(res.status).toBe(403);
  });

  test('o Vendedor não acede ao Perfil da Empresa (organização)', async () => {
    const res = await auth(tokens.fornecedor).get('/api/company-admin/organizacao');
    expect(res.status).toBe(403);
  });

  test('o Company Admin acede ao Perfil da Empresa (organização)', async () => {
    const res = await auth(tokens.companyAdmin).get('/api/company-admin/organizacao');
    expect(res.status).toBe(200);
    expect(res.body.company?.name).toBeTruthy();
  });

  test('o Admin do Sistema vê a ficha de qualquer empresa', async () => {
    const res = await auth(tokens.adminSistema).get(`/api/companies/${outraEmpresaId}`);
    expect(res.status).toBe(200);
  });

  test('o Company Admin não vê a ficha de outra empresa', async () => {
    const res = await auth(tokens.companyAdmin).get(`/api/companies/${outraEmpresaId}`);
    expect(res.status).toBe(403);
  });

  // O perfil PESSOAL continua a funcionar para todos, mas só IDENTIFICA a
  // empresa — não é por aí que os dados bancários e o plano saem.
  test.each(['comprador', 'fornecedor', 'financeiro', 'companyAdmin'])(
    'o perfil pessoal do %s identifica a empresa sem expor dados sensíveis',
    async (persona) => {
      const res = await auth(tokens[persona]).get('/api/users/profile');
      expect(res.status).toBe(200);
      expect(res.body.company?.name).toBeTruthy();
      for (const campo of ['iban', 'swift', 'bankName', 'seatPriceUsd', 'plan', 'planNotes', 'settings']) {
        expect(res.body.company).not.toHaveProperty(campo);
      }
    },
  );

  describe('Apólices (parte da ficha da empresa)', () => {
    test('o Company Admin vê as apólices da própria empresa', async () => {
      const res = await auth(tokens.companyAdmin).get(`/api/policies/company/${companyId}`);
      expect(res.status).toBe(200);
    });

    test('não se leem as apólices de outra empresa', async () => {
      const res = await auth(tokens.companyAdmin).get(`/api/policies/company/${outraEmpresaId}`);
      expect(res.status).toBe(403);
    });
  });
});
