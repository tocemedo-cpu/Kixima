// tests/metricas.test.js
// Métricas de negócio (KX-17).
//
// O Sentry apanha o que se parte. Não apanha o que apenas DEIXA DE ACONTECER —
// e é aí que uma plataforma B2B morre em silêncio: as cotações continuam a
// entrar e param de virar ordens, os pagamentos continuam a ser confirmados
// mas cada vez mais tarde. Nada disso lança uma exceção.
//
// Estes testes olham sobretudo para os casos em que NÃO HÁ DADOS. Uma métrica
// que devolve 0% quando não houve nada é pior do que uma que devolve null: 0%
// lê-se como "está tudo a correr mal" e desencadeia uma investigação a um
// problema que não existe.

const { auth, prisma, loginAll } = require('./helpers');
const metricas = require('../src/services/metricasService');

let tokens;
beforeAll(async () => { tokens = await loginAll(); });
afterAll(async () => { await prisma.$disconnect(); });

describe('Mediana e não média', () => {
  test('um negócio enorme não desloca a mediana', () => {
    // A média de [1,1,1,1,1000] é 200,8 e não descreve nada. A mediana é 1.
    expect(metricas.mediana([1, 1, 1, 1, 1000])).toBe(1);
    expect(metricas.mediana([1, 2, 3, 4])).toBe(2.5);
  });

  test('sem dados devolve null, e não zero', () => {
    // Zero horas até confirmação lê-se como "instantâneo", que é o oposto de
    // "não houve pagamentos nenhuns".
    expect(metricas.mediana([])).toBeNull();
  });
});

describe('Períodos sem atividade', () => {
  test('as taxas ficam nulas em vez de darem 0%', async () => {
    // Uma janela no passado onde não houve nada.
    const antigo = new Date('2001-01-01');
    const r = await metricas.conversaoDeCotacoes({ de: antigo, ate: new Date('2001-12-31') });
    expect(r.pedidas).toBe(0);
    expect(r.taxaDeResposta).toBeNull();
    expect(r.taxaDeFecho).toBeNull();
  });

  test('o volume dá zero, que aí é o número certo', async () => {
    // Aqui zero É a resposta: não passou dinheiro nenhum. A diferença com o
    // caso acima é que "0 kwanzas" é um facto e "0% de conversão" seria uma
    // divisão por zero disfarçada.
    const r = await metricas.volumeTransacionado({ de: new Date('2001-01-01'), ate: new Date('2001-12-31') });
    expect(r.total).toBe(0);
    expect(r.ordens).toBe(0);
    expect(r.ticketMedio).toBe(0);
  });
});

describe('O resumo', () => {
  test('responde às três perguntas, com o período declarado', async () => {
    const r = await metricas.resumo({ dias: 30 });
    expect(r.periodo.dias).toBe(30);
    expect(r.volume).toHaveProperty('total');
    expect(r.cotacoes).toHaveProperty('taxaDeFecho');
    expect(r.tempoAteConfirmacao).toHaveProperty('medianaHoras');
    expect(r.conciliacao).toHaveProperty('taxaAutomatica');
  });

  test('o tempo até confirmação é separado por canal', async () => {
    // É assim que se vê se a conciliação automática valeu a pena: se a mediana
    // da referência bancária não for muito menor do que a da transferência
    // manual, KX-05 não resolveu o que dizia resolver.
    const r = await metricas.resumo({ dias: 3650 });
    expect(typeof r.tempoAteConfirmacao.porCanal).toBe('object');
  });

  test('um número de dias absurdo não rebenta', async () => {
    for (const lixo of ['abc', -5, 0, null]) {
      const r = await metricas.resumo({ dias: lixo });
      expect(r.periodo.dias).toBe(30);
    }
  });
});

describe('Acesso', () => {
  test('só o Admin do Sistema vê as métricas da plataforma', async () => {
    const negado = await auth(tokens.comprador).get('/api/faturacao/metricas');
    expect(negado.status).toBe(403);

    const permitido = await auth(tokens.adminSistema).get('/api/faturacao/metricas');
    expect(permitido.status).toBe(200);
    expect(permitido.body.volume).toBeDefined();
  });
});
