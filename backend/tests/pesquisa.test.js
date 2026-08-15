// tests/pesquisa.test.js
// Pesquisa tolerante a acentos (KX-07).
//
// A avaria que estes testes existem para impedir não dá erro nenhum: a coluna
// `search_text` é escrita pelo GATILHO com o mapa de acentos do SQL, e a
// consulta é montada em JS com o mapa do JS. Se os dois se desencontrarem —
// alguém acrescenta um caractere a um e esquece o outro — a pesquisa continua a
// responder 200, apenas deixa de encontrar coisas. Ninguém abre um bilhete a
// dizer "o mapa de acentos divergiu"; abre-se a dizer "o KIXIMA não encontra os
// meus produtos", meses depois.

const { auth, prisma, loginAll } = require('./helpers');
const marketplace = require('../src/services/marketplaceService');

let tokens;
beforeAll(async () => { tokens = await loginAll(); });
afterAll(async () => { await prisma.$disconnect(); });

describe('O mapa de acentos do JS e o do SQL são o mesmo', () => {
  test('cada caractere acentuado normaliza igual dos dois lados', async () => {
    const amostra = 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ';

    // O lado do JS.
    const emJs = marketplace.normalizarParaPesquisa(amostra);

    // O lado da base — a MESMA função que o gatilho usa.
    const [{ kixima_normalizar: emSql }] = await prisma.$queryRaw`
      SELECT kixima_normalizar(${amostra}) AS kixima_normalizar
    `;

    expect(emJs).toBe(emSql);
  });

  test('frases reais do catálogo dão o mesmo dos dois lados', async () => {
    const frases = [
      'Válvula de esfera 4" API 6D',
      'Inspeção & Ensaios não destrutivos',
      'Manutenção de compressores — óleo & gás',
      'Petroângola, Luanda',
      'JOÃO & FILHOS, LDA.',
    ];
    for (const frase of frases) {
      const [{ n }] = await prisma.$queryRaw`SELECT kixima_normalizar(${frase}) AS n`;
      expect(marketplace.normalizarParaPesquisa(frase)).toBe(n);
    }
  });
});

describe('Procurar sem acentos encontra com acentos', () => {
  test('"valvula" encontra "Válvula"', async () => {
    const comAcento = await auth(tokens.comprador).get('/api/marketplace/search?q=válvula&limit=48');
    const semAcento = await auth(tokens.comprador).get('/api/marketplace/search?q=valvula&limit=48');

    expect(comAcento.status).toBe(200);
    expect(semAcento.status).toBe(200);
    expect(comAcento.body.total).toBeGreaterThan(0);
    // O ponto todo: escrever sem acento não pode dar menos resultados.
    expect(semAcento.body.total).toBe(comAcento.body.total);
  });

  test('a caixa continua a não importar', async () => {
    const a = await auth(tokens.comprador).get('/api/marketplace/search?q=VALVULA&limit=48');
    const b = await auth(tokens.comprador).get('/api/marketplace/search?q=valvula&limit=48');
    expect(a.body.total).toBe(b.body.total);
  });

  test('procurar por parte do nome encontra', async () => {
    const r = await auth(tokens.comprador).get('/api/marketplace/search?q=esfera&limit=48');
    expect(r.status).toBe(200);
    expect(r.body.total).toBeGreaterThan(0);
  });

  test('um termo que não existe devolve zero, e não tudo', async () => {
    // O oposto da avaria: uma normalização demasiado agressiva que reduzisse
    // tudo a nada devolveria o catálogo inteiro para qualquer termo.
    const r = await auth(tokens.comprador).get('/api/marketplace/search?q=zzzznaoexistezzzz&limit=48');
    expect(r.body.total).toBe(0);
  });
});

describe('O gatilho mantém a coluna em dia', () => {
  test('um produto criado ou alterado entra logo na pesquisa', async () => {
    const fornecedor = await prisma.company.findFirst({ where: { type: 'FORNECEDOR' } });
    const criado = await prisma.product.create({
      data: {
        supplierId: fornecedor.id,
        name: 'Ünïcô Prödutö de Teste Açaí',
        category: 'Teste',
        unitPrice: 1000,
        active: true,
      },
      select: { id: true, searchText: true },
    });

    // Escrito pelo gatilho, sem a aplicação ter tocado no campo.
    expect(criado.searchText).toContain('unico produto de teste acai');

    // E acompanha uma alteração.
    const alterado = await prisma.product.update({
      where: { id: criado.id },
      data: { name: 'Rébaptïzado Ção' },
      select: { searchText: true },
    });
    expect(alterado.searchText).toContain('rebaptizado cao');
    expect(alterado.searchText).not.toContain('unico');

    await prisma.product.delete({ where: { id: criado.id } });
  });

  test('o nome do fornecedor segue a mesma regra', async () => {
    const empresa = await prisma.company.findFirst({ where: { type: 'FORNECEDOR' } });
    const nomeOriginal = empresa.name;
    const alterada = await prisma.company.update({
      where: { id: empresa.id },
      data: { name: 'Petroângola Serviços' },
      select: { searchText: true },
    });
    // Sem isto ficava metade da pesquisa tolerante e a outra metade não —
    // pior do que nenhuma das duas, porque não se consegue prever qual é qual.
    expect(alterada.searchText).toContain('petroangola servicos');
    await prisma.company.update({ where: { id: empresa.id }, data: { name: nomeOriginal } });
  });
});
