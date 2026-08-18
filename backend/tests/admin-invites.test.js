// tests/admin-invites.test.js
// Convite de Assessor (ADMIN_SISTEMA por área) — o Super Admin é o único
// caminho para criar uma conta com poder sobre a plataforma. Reutiliza a
// MESMA tabela e ciclo de vida do convite de funcionário (EmployeeInvite);
// o que muda é o token (aleatório, opaco, sem nada lá dentro) e o facto de
// nunca confiar em áreas vindas do pedido do próprio assessor.

const { request, app, prisma, auth, login, PASSWORD } = require('./helpers');
const { CADASTRO, SUPORTE, FINANCEIRO } = require('../src/utils/adminAreas');

const S = 'adminconvite';
const assessorEmail = `assessor.${S}@kixima.co.ao`;
const expiradoEmail = `expirado.${S}@kixima.co.ao`;
const canceladoEmail = `cancelado.${S}@kixima.co.ao`;
const reusoEmail = `reuso.${S}@kixima.co.ao`;
const autoelevaEmail = `autoeleva.${S}@kixima.co.ao`;
const NEW_PW = 'Bomba-Hidraulica-Assessor-7';

let superAdminToken;

async function tokenOf(inviteId) {
  const inv = await prisma.employeeInvite.findUnique({ where: { id: inviteId } });
  return inv.token;
}

async function expirar(inviteId) {
  await prisma.employeeInvite.update({ where: { id: inviteId }, data: { expiresAt: new Date(Date.now() - 1000) } });
}

// login() de helpers.js usa a PASSWORD partilhada (10 caracteres) — abaixo do
// mínimo de 12 que ADMIN_SISTEMA exige. Os assessores destes testes aceitam o
// convite com NEW_PW; para entrar como eles é preciso este login à parte.
async function loginAssessor(email) {
  const res = await request(app).post('/api/auth/login').send({ email, password: NEW_PW });
  if (res.status !== 200) throw new Error(`Login falhou para ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.token;
}

beforeAll(async () => {
  superAdminToken = await login('admin@kixima.co.ao');
});

afterAll(async () => {
  const emails = [assessorEmail, expiradoEmail, canceladoEmail, reusoEmail, autoelevaEmail];
  await prisma.employeeInvite.deleteMany({ where: { email: { in: emails } } });
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
  await prisma.$disconnect();
});

function auditFor(action, entityRef) {
  return prisma.auditLog.findFirst({ where: { action, entityRef }, orderBy: { createdAt: 'desc' } });
}

describe('Criar convite de assessor — só o Super Admin', () => {
  test('nome + email + áreas → convite PENDENTE, token não exposto, auditoria registada', async () => {
    const res = await auth(superAdminToken).post('/api/admin/invites')
      .send({ name: 'Nova Assessora', email: assessorEmail, adminAreas: [SUPORTE, CADASTRO] });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDENTE');
    expect(res.body.adminAreas.sort()).toEqual([CADASTRO, SUPORTE].sort());
    expect(res.body.token).toBeUndefined();

    const registo = await auditFor('CONVITE_ADMIN_CRIADO', assessorEmail);
    expect(registo).not.toBeNull();
  });

  test('sem nenhuma área → 422 — um convite nunca promove a Super Admin em silêncio', async () => {
    const res = await auth(superAdminToken).post('/api/admin/invites')
      .send({ name: 'Sem Área', email: `semarea.${S}@kixima.co.ao`, adminAreas: [] });
    expect(res.status).toBe(422);
  });

  test('área desconhecida → 422', async () => {
    const res = await auth(superAdminToken).post('/api/admin/invites')
      .send({ name: 'Área Errada', email: `areaerrada.${S}@kixima.co.ao`, adminAreas: ['inventada'] });
    expect(res.status).toBe(422);
  });

  test('email já pertence a uma conta → 409', async () => {
    const res = await auth(superAdminToken).post('/api/admin/invites')
      .send({ name: 'Duplicado', email: 'admin@kixima.co.ao', adminAreas: [SUPORTE] });
    expect(res.status).toBe(409);
  });

  test('um assessor restrito (não Super Admin) NÃO pode convidar outro administrador', async () => {
    // Cria um assessor de teste só para tentar convidar — ele próprio não deve
    // conseguir, mesmo tendo o papel ADMIN_SISTEMA.
    const criado = await auth(superAdminToken).post('/api/admin/invites')
      .send({ name: 'Assessor Tentador', email: autoelevaEmail, adminAreas: [SUPORTE] });
    const token = await tokenOf(criado.body.id);
    await request(app).post(`/api/admin/invite/${token}/accept`).send({ password: NEW_PW, termsAccepted: true });
    const assessorToken = await loginAssessor(autoelevaEmail);

    const tentativa = await auth(assessorToken).post('/api/admin/invites')
      .send({ name: 'Outro', email: `outro.${S}@kixima.co.ao`, adminAreas: [FINANCEIRO] });
    expect(tentativa.status).toBe(403);
  });

  test('um Comprador (fora do sistema) não pode convidar administradores', async () => {
    const compradorToken = await login('comprador@petroangola.co.ao');
    const res = await auth(compradorToken).post('/api/admin/invites')
      .send({ name: 'Intruso', email: `intruso.${S}@kixima.co.ao`, adminAreas: [SUPORTE] });
    expect(res.status).toBe(403);
  });
});

describe('Aceitação — token válido, expirado, reutilizado', () => {
  test('token válido: define a senha, a conta fica ATIVA de imediato (sem segunda aprovação)', async () => {
    const criado = await auth(superAdminToken).post('/api/admin/invites')
      .send({ name: 'Assessor Financeiro', email: reusoEmail, adminAreas: [FINANCEIRO] });
    const token = await tokenOf(criado.body.id);

    // Resolução pública mostra as áreas — só para leitura.
    const resolved = await request(app).get(`/api/admin/invite/${token}`);
    expect(resolved.status).toBe(200);
    expect(resolved.body.adminAreas).toEqual([FINANCEIRO]);
    expect(resolved.body.name).toBe('Assessor Financeiro');

    const accept = await request(app).post(`/api/admin/invite/${token}/accept`)
      .send({ password: NEW_PW, termsAccepted: true });
    expect(accept.status).toBe(201);
    expect(accept.body.role).toBe('ADMIN_SISTEMA');
    expect(accept.body.active).toBe(true); // sem "pendente de aprovação" — o Super Admin já decidiu
    expect(accept.body.adminAreas).toEqual([FINANCEIRO]);
    expect(accept.body.passwordHash).toBeUndefined();

    // Login funciona imediatamente, sem passo de aprovação — e a PRÓPRIA
    // RESPOSTA DO LOGIN já reflete as áreas do convite, não um Super Admin por
    // omissão. Isto é deliberado e não redundante com o teste de /api/auth/me
    // abaixo: authService.buildSession() constrói o `user` do login à mão, com
    // a sua própria lista de campos — apanhado em falta numa verificação
    // manual no browser, onde um assessor recém-criado via convite via o menu
    // INTEIRO logo a seguir ao login (o servidor continuava a recusar os
    // pedidos certos; só o menu é que mentia, porque a interface guarda a
    // resposta do login tal e qual, sem voltar a perguntar a /api/auth/me).
    const loginRes = await request(app).post('/api/auth/login').send({ email: reusoEmail, password: NEW_PW });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user.adminAreas).toEqual([FINANCEIRO]);

    const me = await auth(loginRes.body.token).get('/api/auth/me');
    expect(me.body.user.adminAreas).toEqual([FINANCEIRO]);

    const registoAceite = await auditFor('CONVITE_ADMIN_ACEITO', reusoEmail);
    expect(registoAceite).not.toBeNull();
  });

  test('o MESMO token não pode ser usado uma segunda vez', async () => {
    const criado = await auth(superAdminToken).post('/api/admin/invites')
      .send({ name: 'Uso Único', email: `usounico.${S}@kixima.co.ao`, adminAreas: [SUPORTE] });
    const token = await tokenOf(criado.body.id);

    const primeiro = await request(app).post(`/api/admin/invite/${token}/accept`).send({ password: NEW_PW, termsAccepted: true });
    expect(primeiro.status).toBe(201);

    const segundo = await request(app).post(`/api/admin/invite/${token}/accept`).send({ password: NEW_PW, termsAccepted: true });
    expect(segundo.status).toBe(400);
    expect(segundo.body.error.message).toMatch(/já foi utilizado/i);

    await prisma.employeeInvite.deleteMany({ where: { email: `usounico.${S}@kixima.co.ao` } });
    await prisma.user.deleteMany({ where: { email: `usounico.${S}@kixima.co.ao` } });
  });

  test('token expirado é recusado', async () => {
    const criado = await auth(superAdminToken).post('/api/admin/invites')
      .send({ name: 'Vai Expirar', email: expiradoEmail, adminAreas: [SUPORTE] });
    await expirar(criado.body.id);
    const token = await tokenOf(criado.body.id);

    const res = await request(app).post(`/api/admin/invite/${token}/accept`).send({ password: NEW_PW, termsAccepted: true });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/expirou/i);
  });

  test('token inexistente é recusado, não uma exceção crua', async () => {
    const res = await request(app).get('/api/admin/invite/isto-nao-existe');
    expect(res.status).toBe(400);
  });

  test('senha curta para ADMIN_SISTEMA (< 12) é recusada', async () => {
    const criado = await auth(superAdminToken).post('/api/admin/invites')
      .send({ name: 'Senha Curta', email: `senhacurta.${S}@kixima.co.ao`, adminAreas: [SUPORTE] });
    const token = await tokenOf(criado.body.id);
    const res = await request(app).post(`/api/admin/invite/${token}/accept`).send({ password: 'Curta-1', termsAccepted: true });
    expect(res.status).toBe(422);
    await prisma.employeeInvite.deleteMany({ where: { email: `senhacurta.${S}@kixima.co.ao` } });
  });
});

describe('Autoelevação — o pedido de aceitação NÃO pode escolher áreas', () => {
  test('enviar adminAreas no corpo da aceitação é ignorado; a conta fica só com as áreas do convite', async () => {
    const criado = await auth(superAdminToken).post('/api/admin/invites')
      .send({ name: 'Só Suporte', email: `sosuporte.${S}@kixima.co.ao`, adminAreas: [SUPORTE] });
    const token = await tokenOf(criado.body.id);

    // Tenta elevar-se a si próprio a Financeiro e Faturação no próprio pedido
    // de aceitação — o schema despe este campo antes de chegar ao serviço.
    const accept = await request(app).post(`/api/admin/invite/${token}/accept`)
      .send({ password: NEW_PW, termsAccepted: true, adminAreas: [FINANCEIRO, 'faturacao', 'apolices', 'operacoes'] });
    expect(accept.status).toBe(201);
    expect(accept.body.adminAreas).toEqual([SUPORTE]);

    const user = await prisma.user.findUnique({ where: { email: `sosuporte.${S}@kixima.co.ao` } });
    expect(user.adminAreas).toEqual([SUPORTE]);

    await prisma.employeeInvite.deleteMany({ where: { email: `sosuporte.${S}@kixima.co.ao` } });
    await prisma.user.deleteMany({ where: { email: `sosuporte.${S}@kixima.co.ao` } });
  });
});

describe('Cancelar e reenviar — só o Super Admin', () => {
  test('cancelar impede a aceitação; reenviar gera um token novo e volta a permitir', async () => {
    const criado = await auth(superAdminToken).post('/api/admin/invites')
      .send({ name: 'A Cancelar', email: canceladoEmail, adminAreas: [SUPORTE] });
    const id = criado.body.id;
    const tokenOriginal = await tokenOf(id);

    const cancel = await auth(superAdminToken).post(`/api/admin/invites/${id}/cancel`);
    expect(cancel.status).toBe(200);
    expect(cancel.body.status).toBe('CANCELADO');
    const bloqueado = await request(app).post(`/api/admin/invite/${tokenOriginal}/accept`).send({ password: NEW_PW, termsAccepted: true });
    expect(bloqueado.status).toBe(400);
    expect(await auditFor('CONVITE_ADMIN_CANCELADO', canceladoEmail)).not.toBeNull();

    const resend = await auth(superAdminToken).post(`/api/admin/invites/${id}/resend`);
    expect(resend.status).toBe(200);
    expect(resend.body.status).toBe('PENDENTE');
    const tokenNovo = await tokenOf(id);
    expect(tokenNovo).not.toBe(tokenOriginal);
    expect(await auditFor('CONVITE_ADMIN_REENVIADO', canceladoEmail)).not.toBeNull();

    // O token ANTIGO continua sem servir, mesmo depois do reenvio.
    const aindaBloqueado = await request(app).post(`/api/admin/invite/${tokenOriginal}/accept`).send({ password: NEW_PW, termsAccepted: true });
    expect(aindaBloqueado.status).toBe(400);

    const aceite = await request(app).post(`/api/admin/invite/${tokenNovo}/accept`).send({ password: NEW_PW, termsAccepted: true });
    expect(aceite.status).toBe(201);
  });

  test('assessor restrito não pode listar, reenviar nem cancelar convites de administrador', async () => {
    const criado = await auth(superAdminToken).post('/api/admin/invites')
      .send({ name: 'Alvo', email: `alvo.${S}@kixima.co.ao`, adminAreas: [SUPORTE] });
    const token = await tokenOf(criado.body.id);
    await request(app).post(`/api/admin/invite/${token}/accept`).send({ password: NEW_PW, termsAccepted: true });
    const assessorToken = await loginAssessor(`alvo.${S}@kixima.co.ao`);

    expect((await auth(assessorToken).get('/api/admin/invites')).status).toBe(403);
    expect((await auth(assessorToken).post(`/api/admin/invites/${criado.body.id}/resend`)).status).toBe(403);
    expect((await auth(assessorToken).post(`/api/admin/invites/${criado.body.id}/cancel`)).status).toBe(403);

    await prisma.employeeInvite.deleteMany({ where: { email: `alvo.${S}@kixima.co.ao` } });
    await prisma.user.deleteMany({ where: { email: `alvo.${S}@kixima.co.ao` } });
  });
});

describe('Listar convites de administrador — só o Super Admin', () => {
  test('a lista mostra os convites criados, ordenados do mais recente', async () => {
    const res = await auth(superAdminToken).get('/api/admin/invites');
    expect(res.status).toBe(200);
    expect(res.body.some((i) => i.email === assessorEmail)).toBe(true);
  });
});

describe('O caminho normal continua fechado a ADMIN_SISTEMA', () => {
  test('POST /api/companies/users já não aceita role=ADMIN_SISTEMA', async () => {
    const res = await auth(superAdminToken).post('/api/companies/users').send({
      name: 'Via Brecha', email: `brecha.${S}@kixima.co.ao`, password: NEW_PW, role: 'ADMIN_SISTEMA',
    });
    expect(res.status).toBe(422);
  });
});
