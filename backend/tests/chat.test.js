// tests/chat.test.js
// Chat de Suporte, Chat Comercial e Trust & Safety — fluxo completo em tempo
// real (via REST; o Socket.IO em si não abre servidor real nos testes, mas
// toda a lógica de acesso/estado/alerta que ele emite é a mesma testada aqui).
const { auth, prisma, login, USERS, PASSWORD } = require('./helpers');
const authService = require('../src/services/authService');
const { SUPORTE, CADASTRO } = require('../src/utils/adminAreas');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

const EMAIL_AGENTE = 'agente.suporte.chat.teste@kixima.co.ao';
const EMAIL_OUTRO_ADMIN = 'assessor.cadastro.chat.teste@kixima.co.ao';
const TAX_ID_C = 'AO-CLI-9999';

let compradorToken, fornecedorToken, superAdminToken, agenteToken, outroAdminToken;
let buyerCompanyId, supplierCompanyId, empresaCId, empresaCUserToken;

beforeAll(async () => {
  compradorToken = await login(USERS.comprador);
  fornecedorToken = await login(USERS.fornecedor);
  superAdminToken = await login(USERS.adminSistema);

  const comprador = await prisma.user.findUnique({ where: { email: USERS.comprador } });
  const forn = await prisma.user.findUnique({ where: { email: USERS.fornecedor } });
  buyerCompanyId = comprador.companyId;
  supplierCompanyId = forn.companyId;

  const passwordHash = await authService.hashPassword(PASSWORD);
  const agente = await prisma.user.upsert({
    where: { email: EMAIL_AGENTE },
    update: { active: true, role: 'ADMIN_SISTEMA', companyId: null, adminAreas: [SUPORTE] },
    create: { name: 'Agente de Suporte (teste)', email: EMAIL_AGENTE, passwordHash, role: 'ADMIN_SISTEMA', adminAreas: [SUPORTE] },
  });
  agenteToken = await login(EMAIL_AGENTE);

  const outroAdmin = await prisma.user.upsert({
    where: { email: EMAIL_OUTRO_ADMIN },
    update: { active: true, role: 'ADMIN_SISTEMA', companyId: null, adminAreas: [CADASTRO] },
    create: { name: 'Assessor de Cadastro (teste)', email: EMAIL_OUTRO_ADMIN, passwordHash, role: 'ADMIN_SISTEMA', adminAreas: [CADASTRO] },
  });
  outroAdminToken = await login(EMAIL_OUTRO_ADMIN);

  // "Empresa C" — terceira empresa, sem qualquer relação com A (comprador) ou
  // B (fornecedor) — é quem testa o isolamento do Chat Comercial.
  const empresaC = await prisma.company.upsert({
    where: { taxId: TAX_ID_C },
    update: {},
    create: { name: 'Empresa C Terceira, Lda', taxId: TAX_ID_C, type: 'CLIENTE', contactEmail: 'c@empresac.co.ao', status: 'APROVADA', approvedAt: new Date() },
  });
  empresaCId = empresaC.id;
  const emailC = 'comprador.empresac.chat.teste@empresac.co.ao';
  await prisma.user.upsert({
    where: { email: emailC },
    update: { active: true, companyId: empresaCId, role: 'COMPRADOR' },
    create: { name: 'Utilizador Empresa C (teste)', email: emailC, passwordHash, role: 'COMPRADOR', companyId: empresaCId },
  });
  empresaCUserToken = await login(emailC);

  void agente; void outroAdmin;
});

afterAll(async () => {
  await prisma.riskAlert.deleteMany({ where: { conversation: { OR: [{ buyerCompanyId }, { supplierCompanyId: empresaCId }] } } });
  await prisma.conversationMessage.deleteMany({ where: { conversation: { OR: [{ buyerCompanyId }, { supplierCompanyId: empresaCId }] } } });
  await prisma.conversation.deleteMany({ where: { OR: [{ buyerCompanyId }, { supplierCompanyId: empresaCId }] } });
  await prisma.supportMessage.deleteMany({ where: { author: { email: { in: [USERS.comprador, EMAIL_AGENTE] } } } });
  await prisma.user.deleteMany({ where: { email: { in: [EMAIL_AGENTE, EMAIL_OUTRO_ADMIN, 'comprador.empresac.chat.teste@empresac.co.ao'] } } });
  await prisma.company.deleteMany({ where: { taxId: TAX_ID_C } });
  await prisma.$disconnect();
});

describe('Chat de Suporte', () => {
  let ticketId;

  test('cliente abre um pedido → aparece na fila (sem dono ainda)', async () => {
    const criado = await auth(compradorToken).post('/api/support/tickets')
      .send({ subject: 'Não consigo ver a fatura', category: 'Faturação', message: 'A fatura da PO não aparece no meu ecrã.' });
    expect(criado.status).toBe(201);
    ticketId = criado.body.id;

    const fila = await auth(agenteToken).get('/api/support/admin/queue');
    expect(fila.status).toBe(200);
    expect(fila.body.some((t) => t.id === ticketId)).toBe(true);
  });

  test('agente assume o pedido — sai da fila, entra em "os meus atendimentos"', async () => {
    const assumido = await auth(agenteToken).post(`/api/support/admin/tickets/${ticketId}/assume`);
    expect(assumido.status).toBe(200);
    expect(assumido.body.assignedToId).toBeTruthy();
    expect(assumido.body.status).toBe('EM_ANDAMENTO');

    const fila = await auth(agenteToken).get('/api/support/admin/queue');
    expect(fila.body.some((t) => t.id === ticketId)).toBe(false);
    const meus = await auth(agenteToken).get('/api/support/admin/my-tickets');
    expect(meus.body.some((t) => t.id === ticketId)).toBe(true);
  });

  test('agente responde → cliente recebe (histórico) e o estado passa a Aguardando Cliente', async () => {
    const resposta = await auth(agenteToken).post(`/api/support/tickets/${ticketId}/messages`).send({ body: 'Pode indicar o número da PO?' });
    expect(resposta.status).toBe(201);

    const ticket = await auth(agenteToken).get(`/api/support/tickets/${ticketId}`);
    expect(ticket.body.status).toBe('AGUARDANDO_RESPOSTA');
    expect(ticket.body.statusLabel).toBe('Aguardando Cliente');

    const historico = await auth(compradorToken).get(`/api/support/tickets/${ticketId}/messages`);
    expect(historico.status).toBe(200);
    expect(historico.body.some((m) => m.body === 'Pode indicar o número da PO?')).toBe(true);
  });

  test('cliente responde → volta para Em Atendimento; agente resolve → Resolvido', async () => {
    const resp = await auth(compradorToken).post(`/api/support/tickets/${ticketId}/messages`).send({ body: 'É a PO-2026-00001.' });
    expect(resp.status).toBe(201);
    const emAndamento = await auth(agenteToken).get(`/api/support/tickets/${ticketId}`);
    expect(emAndamento.body.status).toBe('EM_ANDAMENTO');

    const resolvido = await auth(agenteToken).post(`/api/support/admin/tickets/${ticketId}/resolve`);
    expect(resolvido.status).toBe(200);
    expect(resolvido.body.status).toBe('RESOLVIDO');
  });

  test('um pedido fechado não aceita novas mensagens sem reabrir', async () => {
    await auth(agenteToken).post(`/api/support/admin/tickets/${ticketId}/close`);
    const bloqueado = await auth(compradorToken).post(`/api/support/tickets/${ticketId}/messages`).send({ body: 'Ainda preciso de ajuda.' });
    expect(bloqueado.status).toBe(409);
    const reaberto = await auth(agenteToken).post(`/api/support/admin/tickets/${ticketId}/reopen`);
    expect(reaberto.status).toBe(200);
    const agora = await auth(compradorToken).post(`/api/support/tickets/${ticketId}/messages`).send({ body: 'Voltei a precisar de ajuda.' });
    expect(agora.status).toBe(201);
  });

  test('anexo — cliente envia um ficheiro junto com a mensagem', async () => {
    const res = await auth(compradorToken).post(`/api/support/tickets/${ticketId}/messages`).field('body', 'Segue print.').attach('attachment', PNG, 'print.png');
    expect(res.status).toBe(201);
    expect(res.body.attachmentUrl).toBeTruthy();
  });

  test('outro utilizador (dono de outro pedido) não acede a este ticket', async () => {
    const res = await auth(fornecedorToken).get(`/api/support/tickets/${ticketId}`);
    expect(res.status).toBe(404);
  });

  test('um assessor sem a área Suporte não acede ao painel/fila', async () => {
    expect((await auth(outroAdminToken).get('/api/support/admin/queue')).status).toBe(403);
  });
});

describe('Chat Comercial', () => {
  let conversationId;

  test('comprador inicia conversa com o fornecedor', async () => {
    const res = await auth(compradorToken).post('/api/conversations').send({ otherCompanyId: supplierCompanyId });
    expect(res.status).toBe(201);
    expect(res.body.buyerCompanyId).toBe(buyerCompanyId);
    expect(res.body.supplierCompanyId).toBe(supplierCompanyId);
    conversationId = res.body.id;
  });

  test('iniciar de novo (mesmo par, sem contexto) reaproveita a mesma conversa', async () => {
    const res = await auth(compradorToken).post('/api/conversations').send({ otherCompanyId: supplierCompanyId });
    expect(res.body.id).toBe(conversationId);
  });

  test('A envia → B recebe → B responde → A recebe', async () => {
    const deA = await auth(compradorToken).post(`/api/conversations/${conversationId}/messages`).send({ body: 'Bom dia, qual o prazo de entrega deste produto?' });
    expect(deA.status).toBe(201);

    const vistoPorB = await auth(fornecedorToken).get(`/api/conversations/${conversationId}/messages`);
    expect(vistoPorB.body.some((m) => m.body === deA.body.body)).toBe(true);

    const deB = await auth(fornecedorToken).post(`/api/conversations/${conversationId}/messages`).send({ body: 'Bom dia! O prazo é de 10 dias úteis.' });
    expect(deB.status).toBe(201);

    const vistoPorA = await auth(compradorToken).get(`/api/conversations/${conversationId}/messages`);
    expect(vistoPorA.body.some((m) => m.body === deB.body.body)).toBe(true);
  });

  test('anexo — fornecedor envia um documento junto com a mensagem', async () => {
    const res = await auth(fornecedorToken).post(`/api/conversations/${conversationId}/messages`).field('body', 'Segue a ficha técnica.').attach('attachment', PNG, 'ficha.png');
    expect(res.status).toBe(201);
    expect(res.body.attachmentUrl).toBeTruthy();
  });

  test('Isolamento — a Empresa C não acede à conversa A↔B (404, não 403)', async () => {
    const verConversa = await auth(empresaCUserToken).get(`/api/conversations/${conversationId}`);
    expect(verConversa.status).toBe(404);
    const verMensagens = await auth(empresaCUserToken).get(`/api/conversations/${conversationId}/messages`);
    expect(verMensagens.status).toBe(404);
    const escrever = await auth(empresaCUserToken).post(`/api/conversations/${conversationId}/messages`).send({ body: 'Tentativa de intrusão.' });
    expect(escrever.status).toBe(404);
  });

  test('Isolamento — o Admin do Sistema NÃO acede a esta conversa sem alerta', async () => {
    const res = await auth(superAdminToken).get(`/api/conversations/admin/conversations/${conversationId}`);
    expect(res.status).toBe(404);
  });

  test('listagem — a conversa aparece para as duas empresas, não para a Empresa C', async () => {
    const paraA = await auth(compradorToken).get('/api/conversations');
    expect(paraA.body.some((c) => c.id === conversationId)).toBe(true);
    const paraC = await auth(empresaCUserToken).get('/api/conversations');
    expect(paraC.body.some((c) => c.id === conversationId)).toBe(false);
  });
});

describe('Trust & Safety', () => {
  let conversationId;

  beforeAll(async () => {
    const res = await auth(fornecedorToken).post('/api/conversations').send({ otherCompanyId: buyerCompanyId });
    conversationId = res.body.id;
  });

  test('1) conversa normal → nenhum alerta', async () => {
    await auth(compradorToken).post(`/api/conversations/${conversationId}/messages`).send({ body: 'Olá, gostaria de saber se têm este item em stock.' });
    const alertas = await auth(agenteToken).get('/api/conversations/admin/alerts');
    expect(alertas.body.some((a) => a.conversation?.id === conversationId)).toBe(false);
  });

  test('2) mensagem ambígua → não chega a gerar alerta persistido (risco baixo)', async () => {
    await auth(compradorToken).post(`/api/conversations/${conversationId}/messages`).send({ body: 'Podemos falar melhor sobre isso, tem whatsapp?' });
    const alertas = await auth(agenteToken).get('/api/conversations/admin/alerts');
    expect(alertas.body.some((a) => a.conversation?.id === conversationId)).toBe(false);
  });

  test('3) indício forte (contacto + intenção de sair da plataforma) → gera alerta', async () => {
    const res = await auth(compradorToken).post(`/api/conversations/${conversationId}/messages`)
      .send({ body: 'Prefiro tratar isso fora da plataforma, me chama no whatsapp: 923456789' });
    expect(res.status).toBe(201);
    const alertas = await auth(agenteToken).get('/api/conversations/admin/alerts');
    const alerta = alertas.body.find((a) => a.conversation?.id === conversationId);
    expect(alerta).toBeTruthy();
    expect(['MEDIUM', 'HIGH', 'CRITICAL']).toContain(alerta.level);
  });

  test('4) tentativa explícita de pagamento fora → HIGH ou CRITICAL', async () => {
    await auth(compradorToken).post(`/api/conversations/${conversationId}/messages`)
      .send({ body: 'Vamos cancelar aqui e fazer o pagamento direto por fora, assim evitamos a taxa da Kixima.' });
    const alertas = await auth(agenteToken).get('/api/conversations/admin/alerts');
    const doMaisRecente = alertas.body.filter((a) => a.conversation?.id === conversationId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    expect(['HIGH', 'CRITICAL']).toContain(doMaisRecente.level);
  });

  test('o Suporte acede à conversa sinalizada (auditado) — só porque tem alerta', async () => {
    const res = await auth(agenteToken).get(`/api/conversations/admin/conversations/${conversationId}`);
    expect(res.status).toBe(200);
    expect(res.body.messages.length).toBeGreaterThan(0);
    expect(res.body.alerts.length).toBeGreaterThan(0);
    const auditoria = await prisma.auditLog.findFirst({ where: { action: 'CONVERSA_SINALIZADA_ACEDIDA', entityId: conversationId }, orderBy: { createdAt: 'desc' } });
    expect(auditoria).toBeTruthy();
  });

  test('5) falso positivo — o Suporte reclassifica o alerta', async () => {
    const alertas = await auth(agenteToken).get('/api/conversations/admin/alerts');
    const alerta = alertas.body.find((a) => a.conversation?.id === conversationId);
    const res = await auth(agenteToken).patch(`/api/conversations/admin/alerts/${alerta.id}`).send({ status: 'FALSO_POSITIVO', decision: 'Cliente só perguntou o preço de outra forma.' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('FALSO_POSITIVO');
    expect(res.body.reviewedById).toBeTruthy();
  });

  test('6) utilizador sem autorização não acede ao painel de alertas nem à conversa sinalizada', async () => {
    expect((await auth(compradorToken).get('/api/conversations/admin/alerts')).status).toBe(403);
    expect((await auth(outroAdminToken).get('/api/conversations/admin/alerts')).status).toBe(403);
    expect((await auth(outroAdminToken).get(`/api/conversations/admin/conversations/${conversationId}`)).status).toBe(403);
  });
});
