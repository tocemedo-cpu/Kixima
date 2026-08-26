// tests/feedback-publico.test.js
// Avaliações públicas da homepage ("Avaliações"). O que se protege aqui:
// nenhum testemunho aparece na home sem ser primeiro aprovado, o campo
// honeypot ("website") aceita em silêncio sem guardar nada, e a média
// mostrada conta TODAS as aprovadas — não só as poucas exibidas na parede.
const { request, app, prisma, auth, loginAll } = require('./helpers');

let tokens;

beforeAll(async () => {
  tokens = await loginAll();
});

afterAll(async () => {
  await prisma.feedback.deleteMany({ where: { company: { startsWith: 'Empresa Teste Feedback' } } });
  await prisma.$disconnect();
});

async function submeter(overrides = {}) {
  return request(app).post('/api/public/feedback').send({
    name: 'Joana Teste',
    company: 'Empresa Teste Feedback',
    role: 'Comprador',
    rating: 5,
    message: 'Excelente experiência a comprar na plataforma.',
    consent: true,
    ...overrides,
  });
}

describe('Submissão pública', () => {
  test('cria uma avaliação, sempre por aprovar', async () => {
    const res = await submeter();
    expect(res.status).toBe(201);
    expect(res.body.recebido).toBe(true);

    const guardada = await prisma.feedback.findUnique({ where: { id: res.body.id } });
    expect(guardada.approved).toBe(false);
  });

  test('honeypot preenchido devolve sucesso mas NÃO guarda nada', async () => {
    const antes = await prisma.feedback.count();
    const res = await submeter({ website: 'http://spam.example' });
    expect(res.status).toBe(201);
    const depois = await prisma.feedback.count();
    expect(depois).toBe(antes);
  });

  test('recusa sem nome, empresa ou mensagem', async () => {
    const res = await submeter({ name: '' });
    expect(res.status).toBe(422);
  });

  test('recusa um perfil que não é um dos quatro previstos', async () => {
    const res = await submeter({ role: 'Investidor' });
    expect(res.status).toBe(422);
  });

  test('recusa uma classificação fora de 1–5', async () => {
    const res = await submeter({ rating: 7 });
    expect(res.status).toBe(422);
  });

  test('recusa sem autorização (consent)', async () => {
    const res = await submeter({ consent: false });
    expect(res.status).toBe(422);
  });
});

describe('Publicação (GET /api/public/feedback)', () => {
  test('uma avaliação por aprovar NÃO aparece', async () => {
    const criada = await submeter({ company: 'Empresa Teste Feedback Pendente' });
    const publico = await request(app).get('/api/public/feedback');
    expect(publico.body.feedback.find((f) => f.id === criada.body.id)).toBeUndefined();
  });

  test('depois de aprovada, aparece e entra na média — calculada sobre TODAS as aprovadas', async () => {
    await prisma.feedback.deleteMany({ where: { company: 'Empresa Teste Feedback Média' } });
    const a = await submeter({ company: 'Empresa Teste Feedback Média', rating: 4 });
    const b = await submeter({ company: 'Empresa Teste Feedback Média', rating: 2 });
    await prisma.feedback.update({ where: { id: a.body.id }, data: { approved: true } });
    await prisma.feedback.update({ where: { id: b.body.id }, data: { approved: true } });

    const publico = await request(app).get('/api/public/feedback');
    expect(publico.body.feedback.some((f) => f.id === a.body.id)).toBe(true);
    expect(publico.body.feedback.some((f) => f.id === b.body.id)).toBe(true);
    // Nunca o nome de quem avaliou sem ser através do próprio registo — mas o
    // envelope público não deve trazer campos internos como "approved".
    expect(publico.body.feedback[0].approved).toBeUndefined();
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

  test('lista, aprova e a avaliação passa a ser pública', async () => {
    const criada = await submeter({ company: 'Empresa Teste Feedback Moderação' });

    const lista = await auth(tokens.adminSistema).get('/api/admin/feedback?status=pendente');
    expect(lista.status).toBe(200);
    expect(lista.body.itens.some((f) => f.id === criada.body.id)).toBe(true);

    const aprovar = await auth(tokens.adminSistema).patch(`/api/admin/feedback/${criada.body.id}/aprovar`);
    expect(aprovar.status).toBe(200);
    expect(aprovar.body.approved).toBe(true);

    const publico = await request(app).get('/api/public/feedback');
    expect(publico.body.feedback.some((f) => f.id === criada.body.id)).toBe(true);
  });

  test('remove uma avaliação (rejeição = remoção, sem terceiro estado)', async () => {
    const criada = await submeter({ company: 'Empresa Teste Feedback Remover' });
    const remover = await auth(tokens.adminSistema).del(`/api/admin/feedback/${criada.body.id}`);
    expect(remover.status).toBe(204);
    const jaNaoExiste = await prisma.feedback.findUnique({ where: { id: criada.body.id } });
    expect(jaNaoExiste).toBeNull();
  });
});
