// tests/admin-areas.test.js
// ADMIN_SISTEMA deixa de ser um papel só: pode ser um Super Admin (acede a
// tudo) ou um assessor restrito a uma ou mais áreas (cadastro, financeiro,
// faturação, apólices, suporte, operações).
//
// O QUE ISTO PROTEGE. Até aqui, dar a alguém o papel ADMIN_SISTEMA era dar-lhe
// literalmente tudo: aprovar empresas, mudar planos, emitir faturas
// certificadas AGT, decidir apólices, gerir suporte, fazer cópias de
// segurança. Sem meio-termo. As áreas dão esse meio-termo — mas só valem
// alguma coisa se: (1) um assessor restrito for mesmo barrado fora da sua
// área, (2) ninguém conseguir alargar as PRÓPRIAS áreas, e (3) quem já tinha
// o papel antes de isto existir não perca acesso a nada.

const { prisma, app, PASSWORD, USERS, login, auth } = require('./helpers');
const request = require('supertest');
const authService = require('../src/services/authService');
const { AREAS_ADMIN, CADASTRO, FINANCEIRO, FATURACAO, APOLICES, SUPORTE, OPERACOES } = require('../src/utils/adminAreas');

const EMAIL_ASSESSOR = 'assessor.suporte.teste@kixima.co.ao';
let superAdminToken;
let superAdminId;
let assessorId;
let assessorToken;

function auditFor(action) {
  return prisma.auditLog.findFirst({ where: { action }, orderBy: { createdAt: 'desc' } });
}

beforeAll(async () => {
  superAdminToken = await login(USERS.adminSistema);
  const superAdmin = await prisma.user.findUnique({ where: { email: USERS.adminSistema } });
  superAdminId = superAdmin.id;
  // O seed não tem uma segunda conta ADMIN_SISTEMA; um assessor restrito à
  // área de Suporte é criado diretamente, como qualquer outro fixture de teste.
  const passwordHash = await authService.hashPassword(PASSWORD);
  const assessor = await prisma.user.upsert({
    where: { email: EMAIL_ASSESSOR },
    update: { active: true, role: 'ADMIN_SISTEMA', companyId: null, adminAreas: [SUPORTE] },
    create: {
      name: 'Assessor de Suporte (teste)', email: EMAIL_ASSESSOR, passwordHash, role: 'ADMIN_SISTEMA', adminAreas: [SUPORTE],
    },
  });
  assessorId = assessor.id;
  assessorToken = await login(EMAIL_ASSESSOR);
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: EMAIL_ASSESSOR } });
  await prisma.$disconnect();
});

describe('Compatibilidade — quem já era ADMIN_SISTEMA continua Super Admin', () => {
  test('adminAreas vazio por omissão — acede a tudo, sem precisar de nada explícito', async () => {
    const me = await auth(superAdminToken).get('/api/auth/me');
    expect(me.body.user.adminAreas).toEqual([]);
  });

  test('Super Admin acede a uma rota de CADA área, sem ser barrado', async () => {
    const respostas = await Promise.all([
      auth(superAdminToken).get('/api/companies'), // cadastro
      auth(superAdminToken).get('/api/conciliacao/canais'), // financeiro
      auth(superAdminToken).get('/api/faturacao/metricas'), // faturacao
      auth(superAdminToken).get('/api/support/admin/overview'), // suporte
      auth(superAdminToken).get('/api/admin/prontidao'), // operacoes
      auth(superAdminToken).get('/api/admin/users'), // reservado ao super admin
    ]);
    for (const r of respostas) expect(r.status).not.toBe(403);
  });
});

describe('Um assessor restrito só chega à sua área', () => {
  test('a própria área — Suporte — responde normalmente', async () => {
    const r = await auth(assessorToken).get('/api/support/admin/overview');
    expect(r.status).toBe(200);
  });

  test('fora da área, é barrado com 403 e uma mensagem que diz qual área falta', async () => {
    const r = await auth(assessorToken).get('/api/companies');
    expect(r.status).toBe(403);
    expect(r.body.error.message).toMatch(/cadastro/i);
  });

  test('operações também fica de fora', async () => {
    const r = await auth(assessorToken).get('/api/admin/prontidao');
    expect(r.status).toBe(403);
  });

  test('financeiro também', async () => {
    const r = await auth(assessorToken).get('/api/conciliacao/canais');
    expect(r.status).toBe(403);
  });

  test('faturação também — é a mais sensível (dados fiscais), fica isolada mesmo de financeiro', async () => {
    const r = await auth(assessorToken).get('/api/faturacao/metricas');
    expect(r.status).toBe(403);
  });

  test('a permissão barra ANTES da validação — um corpo inválido não escapa por engano', async () => {
    // Se a ordem fosse invertida (validar primeiro, permissão depois), um
    // pedido malformado podia devolver 422 em vez de 403 — a informação errada
    // sobre o motivo da recusa.
    const r = await auth(assessorToken).patch('/api/policies/supplier-to-kixima/inexistente/decision').send({});
    expect(r.status).toBe(403);
  });
});

describe('Auditoria — visível a qualquer ADMIN_SISTEMA, restrito ou não', () => {
  test('o assessor de Suporte lê o mesmo trilho de auditoria que o Super Admin', async () => {
    // Decisão deliberada: quem vigia se um assessor restrito está a fazer o
    // que devia precisa de ver o rasto de TUDO, não só da própria área.
    const r = await auth(assessorToken).get('/api/admin/audit-logs');
    expect(r.status).toBe(200);
  });
});

describe('Outras personas não são afetadas — adminAreas não lhes diz respeito', () => {
  test('o FINANCEIRO da empresa acede às suas rotas normalmente', async () => {
    const finToken = await login(USERS.financeiro);
    const r = await auth(finToken).get('/api/conciliacao/canais');
    expect(r.status).toBe(200);
  });
});

describe('canManageImages reflete a área real, não só o papel', () => {
  test('true para o assessor de Suporte', async () => {
    const r = await auth(assessorToken).get('/api/support/overview');
    expect(r.body.canManageImages).toBe(true);
  });

  test('true para o Super Admin', async () => {
    const r = await auth(superAdminToken).get('/api/support/overview');
    expect(r.body.canManageImages).toBe(true);
  });

  test('false para quem não é ADMIN_SISTEMA', async () => {
    const compradorToken = await login(USERS.comprador);
    const r = await auth(compradorToken).get('/api/support/overview');
    expect(r.body.canManageImages).toBe(false);
  });
});

describe('Gerir áreas — reservado ao Super Admin', () => {
  afterEach(async () => {
    // Devolve o assessor ao estado inicial do describe seguinte não herdar mudanças.
    await prisma.user.update({ where: { id: assessorId }, data: { adminAreas: [SUPORTE] } });
  });

  test('o Super Admin atribui áreas, e fica registado na auditoria', async () => {
    const r = await auth(superAdminToken)
      .patch(`/api/admin/users/${assessorId}/areas`)
      .send({ areas: [SUPORTE, OPERACOES] });
    expect(r.status).toBe(200);
    expect(r.body.adminAreas.sort()).toEqual([OPERACOES, SUPORTE].sort());

    const registo = await auditFor('AREAS_DE_ADMIN_ALTERADAS');
    expect(registo).not.toBeNull();
    expect(registo.entityId).toBe(assessorId);
  });

  test('uma área desconhecida é recusada com 422', async () => {
    const r = await auth(superAdminToken)
      .patch(`/api/admin/users/${assessorId}/areas`)
      .send({ areas: ['inventada'] });
    expect(r.status).toBe(422);
  });

  test('o assessor NÃO pode atribuir áreas a ninguém — nem a si próprio', async () => {
    const r = await auth(assessorToken)
      .patch(`/api/admin/users/${assessorId}/areas`)
      .send({ areas: [] }); // tentaria tornar-se Super Admin
    expect(r.status).toBe(403);
  });

  test('nem o Super Admin pode alterar as PRÓPRIAS áreas — risco de se trancar de fora', async () => {
    const r = await auth(superAdminToken)
      .patch(`/api/admin/users/${superAdminId}/areas`)
      .send({ areas: [SUPORTE] });
    expect(r.status).toBe(400);
  });

  test('e "gerir utilizadores" (bloquear/desbloquear) também é reservado ao Super Admin', async () => {
    const r = await auth(assessorToken).get('/api/admin/users');
    expect(r.status).toBe(403);
  });
});

test('AREAS_ADMIN cobre exatamente as seis áreas propostas — muda aqui se a lista mudar', () => {
  expect(AREAS_ADMIN.sort()).toEqual(
    [CADASTRO, FINANCEIRO, FATURACAO, APOLICES, SUPORTE, OPERACOES].sort(),
  );
});
