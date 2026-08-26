// tests/feedback-publico.test.js
// Avaliações ("Avaliações Verificadas" da homepage). O que se protege aqui:
// nenhuma avaliação é anónima (autoria vem sempre de req.user), o alvo
// escolhido tem de ser um registo real da empresa do autor, nenhum
// testemunho aparece na home sem ser primeiro aprovado, e a média mostrada
// conta TODAS as aprovadas — não só as poucas exibidas na parede.
const { request, app, prisma, auth, loginAll } = require('./helpers');

let tokens;
let compradorId;
let fornecedorId;
let compradorUserId;
let po;

beforeAll(async () => {
  tokens = await loginAll();
  const comprador = await prisma.user.findUnique({ where: { email: 'comprador@petroangola.co.ao' } });
  const fornecedor = await prisma.company.findFirst({ where: { users: { some: { email: 'fornecedor@kianda.co.ao' } } } });
  compradorUserId = comprador.id;
  compradorId = comprador.companyId;
  fornecedorId = fornecedor.id;

  po = await prisma.purchaseOrder.create({
    data: {
      reference: `PO-TESTE-FEEDBACK-${Date.now()}`,
      buyerCompanyId: compradorId,
      supplierCompanyId: fornecedorId,
      createdById: compradorUserId,
      totalAmount: 1,
      status: 'CONCLUIDA',
      deliveredAt: new Date(),
      receivedAt: new Date(),
    },
  });
});

afterAll(async () => {
  await prisma.feedback.deleteMany({ where: { userId: compradorUserId } });
  await prisma.purchaseOrder.delete({ where: { id: po.id } }).catch(() => {});
  await prisma.$disconnect();
});

function submeter(token, overrides = {}) {
  return auth(token).post('/api/feedback').send({
    categoria: 'EXPERIENCIA_GERAL',
    rating: 5,
    message: 'Excelente experiência a comprar na plataforma.',
    ...overrides,
  });
}

describe('Submissão — exige sessão', () => {
  test('recusa sem autenticação', async () => {
    const res = await request(app).post('/api/feedback').send({ categoria: 'EXPERIENCIA_GERAL', rating: 5, message: 'Teste' });
    expect(res.status).toBe(401);
  });

  test('cria uma avaliação de experiência geral (sem alvo), sempre por aprovar e sempre verificada', async () => {
    const res = await submeter(tokens.comprador);
    expect(res.status).toBe(201);
    expect(res.body.recebido).toBe(true);

    const guardada = await prisma.feedback.findUnique({ where: { id: res.body.id } });
    expect(guardada.approved).toBe(false);
    expect(guardada.verified).toBe(true);
    expect(guardada.userId).toBe(compradorUserId);
    expect(guardada.companyId).toBe(compradorId);
    expect(guardada.targetId).toBeNull();
  });

  test('recusa categoria inválida', async () => {
    const res = await submeter(tokens.comprador, { categoria: 'INVENTADA' });
    expect(res.status).toBe(422);
  });

  test('recusa classificação fora de 1–5', async () => {
    const res = await submeter(tokens.comprador, { rating: 7 });
    expect(res.status).toBe(422);
  });

  test('recusa sem mensagem', async () => {
    const res = await submeter(tokens.comprador, { message: '' });
    expect(res.status).toBe(422);
  });

  test('exige um alvo quando a categoria não é experiência geral', async () => {
    const res = await submeter(tokens.comprador, { categoria: 'PEDIDO' });
    expect(res.status).toBe(422);
  });

  test('recusa um alvo que não pertence ao histórico real da empresa', async () => {
    const res = await submeter(tokens.comprador, { categoria: 'FORNECEDOR', targetId: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(422);
  });

  test('aceita um alvo real — fornecedor com quem a empresa transacionou — e grava o snapshot do nome', async () => {
    const res = await submeter(tokens.comprador, { categoria: 'FORNECEDOR', targetId: fornecedorId });
    expect(res.status).toBe(201);
    const guardada = await prisma.feedback.findUnique({ where: { id: res.body.id } });
    expect(guardada.targetId).toBe(fornecedorId);
    expect(guardada.targetLabel).toBeTruthy();
  });

  test('aceita um pedido real da empresa', async () => {
    const res = await submeter(tokens.comprador, { categoria: 'PEDIDO', targetId: po.id });
    expect(res.status).toBe(201);
  });

  test('aceita uma entrega real (pedido já entregue)', async () => {
    const res = await submeter(tokens.comprador, { categoria: 'ENTREGA', targetId: po.id });
    expect(res.status).toBe(201);
  });
});

describe('Opções (GET /api/feedback/opcoes) — alvos reais, nunca inventados', () => {
  test('exige sessão', async () => {
    const res = await request(app).get('/api/feedback/opcoes');
    expect(res.status).toBe(401);
  });

  test('inclui o fornecedor e o pedido reais da empresa do comprador', async () => {
    const res = await auth(tokens.comprador).get('/api/feedback/opcoes');
    expect(res.status).toBe(200);
    expect(res.body.FORNECEDOR.some((o) => o.id === fornecedorId)).toBe(true);
    expect(res.body.PEDIDO.some((o) => o.id === po.id)).toBe(true);
    expect(res.body.ENTREGA.some((o) => o.id === po.id)).toBe(true);
  });

  test('Admin do Sistema (sem empresa) recebe listas vazias, nunca inventadas', async () => {
    const res = await auth(tokens.adminSistema).get('/api/feedback/opcoes');
    expect(res.status).toBe(200);
    expect(res.body.FORNECEDOR).toEqual([]);
  });
});

describe('Minhas avaliações (GET /api/feedback/minhas)', () => {
  test('devolve só as do próprio utilizador, qualquer estado', async () => {
    const res = await auth(tokens.comprador).get('/api/feedback/minhas');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((f) => f.user.name)).toBe(true);
  });
});

describe('Publicação (GET /api/public/feedback) — só leitura, sem submissão anónima', () => {
  test('POST anónimo já não existe', async () => {
    const res = await request(app).post('/api/public/feedback').send({ rating: 5, message: 'x' });
    expect(res.status).toBe(404);
  });

  test('uma avaliação por aprovar NÃO aparece', async () => {
    const criada = await submeter(tokens.comprador);
    const publico = await request(app).get('/api/public/feedback');
    expect(publico.body.feedback.find((f) => f.id === criada.body.id)).toBeUndefined();
  });

  test('depois de aprovada, aparece com nome, empresa, categoria e selo — e entra na média calculada sobre TODAS as aprovadas', async () => {
    await prisma.feedback.deleteMany({ where: { approved: true } });
    const a = await submeter(tokens.comprador, { rating: 4 });
    const b = await submeter(tokens.comprador, { rating: 2 });
    await prisma.feedback.update({ where: { id: a.body.id }, data: { approved: true } });
    await prisma.feedback.update({ where: { id: b.body.id }, data: { approved: true } });

    const publico = await request(app).get('/api/public/feedback');
    const visivel = publico.body.feedback.find((f) => f.id === a.body.id);
    expect(visivel).toBeTruthy();
    expect(visivel.user.name).toBeTruthy();
    expect(visivel.company.name).toBeTruthy();
    expect(visivel.verified).toBe(true);
    expect(visivel.approved).toBeUndefined();
    expect(publico.body.average).toBeCloseTo(3, 1);
  });

  test('sem avaliações aprovadas, devolve lista vazia e média 0 — nunca inventada', async () => {
    await prisma.feedback.deleteMany({});
    const publico = await request(app).get('/api/public/feedback');
    expect(publico.body.feedback).toEqual([]);
    expect(publico.body.average).toBe(0);
    expect(publico.body.total).toBe(0);
  });
});

describe('Moderação (Admin do Sistema)', () => {
  test('só o Admin do Sistema modera', async () => {
    const negado = await auth(tokens.fornecedor).get('/api/admin/feedback');
    expect(negado.status).toBe(403);
  });

  test('lista com identidade do autor, aprova e a avaliação passa a ser pública', async () => {
    const criada = await submeter(tokens.comprador);

    const lista = await auth(tokens.adminSistema).get('/api/admin/feedback?status=pendente');
    expect(lista.status).toBe(200);
    const item = lista.body.itens.find((f) => f.id === criada.body.id);
    expect(item).toBeTruthy();
    expect(item.user.name).toBeTruthy();
    expect(item.company.name).toBeTruthy();

    const aprovar = await auth(tokens.adminSistema).patch(`/api/admin/feedback/${criada.body.id}/aprovar`);
    expect(aprovar.status).toBe(200);
    expect(aprovar.body.approved).toBe(true);

    const publico = await request(app).get('/api/public/feedback');
    expect(publico.body.feedback.some((f) => f.id === criada.body.id)).toBe(true);
  });

  test('remove uma avaliação (rejeição = remoção, sem terceiro estado)', async () => {
    const criada = await submeter(tokens.comprador);
    const remover = await auth(tokens.adminSistema).del(`/api/admin/feedback/${criada.body.id}`);
    expect(remover.status).toBe(204);
    const jaNaoExiste = await prisma.feedback.findUnique({ where: { id: criada.body.id } });
    expect(jaNaoExiste).toBeNull();
  });
});
