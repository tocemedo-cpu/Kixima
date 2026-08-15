// tests/paginacao.test.js
// Paginação com contagem total (KX-06).
//
// O que se corrigiu não foi "as listas eram grandes" — foi haver TECTOS FIXOS a
// esconder linhas sem o dizer: as notificações paravam nas 50 e os movimentos de
// stock nas 200, e a resposta era um array simples, sem contagem. Nem a
// interface tinha como saber que faltava alguma coisa.
//
// Uma lista truncada em silêncio é pior do que uma lista que não abre: quem a lê
// toma decisões com ela a acreditar que está completa.

const { auth, prisma, loginAll, USERS } = require('./helpers');
const paginacao = require('../src/utils/paginacao');

let tokens;
beforeAll(async () => { tokens = await loginAll(); });
afterAll(async () => { await prisma.$disconnect(); });

describe('Os parâmetros de paginação não se deixam empurrar', () => {
  test('sem nada, usa o valor por omissão', () => {
    expect(paginacao.parametros({})).toMatchObject({ pagina: 1, porPagina: paginacao.POR_OMISSAO, skip: 0 });
  });

  test('um limite absurdo é cortado no máximo', () => {
    // `?limit=100000` é um pedido, vindo do exterior, para carregar a tabela
    // toda para memória — que é precisamente o que o tecto existe para impedir.
    expect(paginacao.parametros({ limit: 100000 }).porPagina).toBe(paginacao.MAXIMO);
  });

  test('páginas e limites inválidos caem no razoável, sem rebentar', () => {
    for (const lixo of ['abc', '-3', '0', '', null, undefined, {}]) {
      const p = paginacao.parametros({ page: lixo, limit: lixo });
      expect(p.pagina).toBe(1);
      expect(p.porPagina).toBe(paginacao.POR_OMISSAO);
      expect(p.skip).toBe(0);
    }
  });

  test('o salto é calculado a partir da página', () => {
    expect(paginacao.parametros({ page: 3, limit: 10 })).toMatchObject({ skip: 20, take: 10 });
  });

  test('o número de páginas nunca é zero', () => {
    // Zero páginas obrigaria a interface a tratar um caso especial que não
    // existe: mesmo sem nada, há uma página — vazia.
    expect(paginacao.envelope([], 0, { pagina: 1, porPagina: 25 }).paginas).toBe(1);
  });
});

describe('Notificações', () => {
  test('a resposta traz os itens, o total e quantas estão por ler', async () => {
    const res = await auth(tokens.comprador).get('/api/notifications');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.itens)).toBe(true);
    expect(typeof res.body.total).toBe('number');
    expect(typeof res.body.porLer).toBe('number');
    expect(res.body.paginas).toBeGreaterThanOrEqual(1);
  });

  test('o contador de por ler é de TODAS, não só das desta página', async () => {
    const utilizador = await prisma.user.findUnique({ where: { email: USERS.comprador } });
    const where = { OR: [{ userId: utilizador.id }, { companyId: utilizador.companyId }], readAt: null };
    const naBase = await prisma.notification.count({ where });

    // Uma página de UM item: se o contador viesse da página, daria 1 ou 0.
    // Um sino que muda de número ao paginar parece uma avaria.
    const res = await auth(tokens.comprador).get('/api/notifications?limit=1');
    expect(res.body.itens.length).toBeLessThanOrEqual(1);
    expect(res.body.porLer).toBe(naBase);
  });

  test('a segunda página não repete a primeira', async () => {
    const p1 = await auth(tokens.comprador).get('/api/notifications?limit=1&page=1');
    const p2 = await auth(tokens.comprador).get('/api/notifications?limit=1&page=2');
    if (p1.body.total > 1) {
      expect(p2.body.itens[0].id).not.toBe(p1.body.itens[0].id);
    }
  });
});

describe('Movimentos de stock', () => {
  test('a resposta traz o total, e não só os que couberam', async () => {
    const res = await auth(tokens.fornecedor).get('/api/catalog/movements');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.itens)).toBe(true);
    expect(typeof res.body.total).toBe('number');
    // O total conta TODOS, independentemente da página pedida.
    expect(res.body.total).toBeGreaterThanOrEqual(res.body.itens.length);
  });

  test('pedir mais do que o máximo não devolve mais do que o máximo', async () => {
    const res = await auth(tokens.fornecedor).get('/api/catalog/movements?limit=100000');
    expect(res.body.itens.length).toBeLessThanOrEqual(paginacao.MAXIMO);
    expect(res.body.porPagina).toBe(paginacao.MAXIMO);
  });
});
