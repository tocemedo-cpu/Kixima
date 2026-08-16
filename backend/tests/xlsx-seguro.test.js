// tests/xlsx-seguro.test.js
// A leitura de Excel corre num isolado, com tempo-limite e tecto de memória.
//
// O QUE ISTO PROTEGE. A biblioteca `xlsx` (SheetJS) tem duas falhas de
// severidade alta com aviso explícito de "No fix available" — Prototype
// Pollution e ReDoS — e não há versão para onde subir. A resposta foi conter em
// vez de reescrever: a leitura acontece noutro isolado V8, e só atravessam
// valores simples.
//
// O QUE VALE A PENA TESTAR não é o isolamento em si (é o Node que o dá), mas os
// LIMITES, que são a parte que se estraga em silêncio. Um isolado sem quem o
// mate não é contenção nenhuma: é uma thread presa a consumir memória num
// contentor de 512 MB, e ao fim de alguns ficheiros a plataforma pára.

const XLSX = require('xlsx');
const path = require('path');
const { execFileSync } = require('child_process');
const { BusinessRuleError } = require('../src/utils/errors');

const xlsxSeguro = require('../src/services/xlsxSeguro');

function construir(linhas, nomeDaFolha = 'Catálogo') {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(linhas), nomeDaFolha);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

describe('Leitura normal', () => {
  test('devolve as linhas de um ficheiro válido', async () => {
    const buf = construir([['A', 'B'], ['1', '2']]);
    const linhas = await xlsxSeguro.lerLinhas(buf, ['catálogo']);
    expect(linhas).toEqual([['A', 'B'], ['1', '2']]);
  });

  test('escolhe a folha pelo nome, ignorando maiúsculas e espaços', async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['errada']]), 'Instruções');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['certa']]), ' PRODUTOS ');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const linhas = await xlsxSeguro.lerLinhas(buf, ['produtos']);
    expect(linhas[0][0]).toBe('certa');
  });

  test('sem nome que bata, usa a primeira folha', async () => {
    // O comportamento antigo, que a importação em massa depende: quem exporta
    // do seu próprio sistema raramente chama à folha "Catálogo".
    const buf = construir([['primeira']], 'Folha1');
    const linhas = await xlsxSeguro.lerLinhas(buf, ['catálogo', 'produtos']);
    expect(linhas[0][0]).toBe('primeira');
  });
});

describe('O que atravessa a fronteira', () => {
  test('são só valores simples, sem protótipos vindos da biblioteca', async () => {
    // É esta a defesa contra Prototype Pollution. Devolver o objeto do workbook
    // traria de volta, por estrutura clonada, exatamente aquilo que se veio
    // isolar — por isso o worker faz `JSON.parse(JSON.stringify(...))`.
    const buf = construir([['x'], ['y']]);
    const linhas = await xlsxSeguro.lerLinhas(buf, []);

    // `Array.isArray` e não `getPrototypeOf(...) === Array.prototype`: o Jest
    // corre cada ficheiro de teste no seu próprio contexto de VM, por isso o
    // `Array.prototype` daqui nunca é o mesmo objeto que o da mensagem
    // desserializada — a comparação por identidade falharia sem nada estar mal.
    expect(Array.isArray(linhas)).toBe(true);
    for (const linha of linhas) {
      expect(Array.isArray(linha)).toBe(true);
      for (const celula of linha) {
        expect(celula === null || ['string', 'number', 'boolean'].includes(typeof celula)).toBe(true);
      }
    }
  });

  test('uma folha chamada __proto__ não suja o processo principal', async () => {
    // Não é o ataque real — o ataque real vive dentro do parser. É a prova de
    // que o nome de uma folha atravessa como texto e nada mais.
    const buf = construir([['inofensivo']], '__proto__');
    await xlsxSeguro.lerLinhas(buf, []);
    expect({}.poluido).toBeUndefined();
    expect(Object.prototype.poluido).toBeUndefined();
  });
});

describe('Ficheiro que não se lê', () => {
  test('um .xlsx corrompido dá erro de negócio, não uma exceção crua', async () => {
    // O que interessa é o TIPO: BusinessRuleError é o que o errorHandler
    // central traduz em 422 com a mensagem visível. Uma exceção crua daria 500
    // e um registo de erro para quem apenas enviou um ficheiro estragado.
    //
    // Um .xlsx é um ZIP; este parece um e não é, que é o caso real de um upload
    // interrompido a meio.
    const corrompido = Buffer.concat([Buffer.from('PK\x03\x04'), Buffer.alloc(200, 7)]);
    await expect(xlsxSeguro.lerLinhas(corrompido, [])).rejects.toThrow(BusinessRuleError);
    await expect(xlsxSeguro.lerLinhas(corrompido, [])).rejects.toThrow(/xlsx válido/i);
  });

  test('texto simples e ficheiro vazio NÃO são rejeitados aqui — e está certo', async () => {
    // Comportamento medido, não suposto: o SheetJS deteta o formato sozinho e
    // interpreta qualquer texto como CSV. Um PDF ou um .txt renomeado passam
    // por aqui como uma folha de uma coluna, em vez de dar erro.
    //
    // Isto não é uma falha desta fronteira e não se corrige aqui: quem rejeita
    // é a validação de colunas da importação, que exige o cabeçalho do catálogo
    // (ver "rejeita ficheiro sem as colunas mínimas" em catalog-import.test.js).
    // Fica registado porque a leitura ingénua deste módulo é assumir o
    // contrário, e ao escrever este teste foi isso que se assumiu.
    const texto = await xlsxSeguro.lerLinhas(Buffer.from('isto não é um xlsx'), []);
    expect(texto).toEqual([['isto nÃ£o Ã© um xlsx']]);

    const vazio = await xlsxSeguro.lerLinhas(Buffer.alloc(0), []);
    expect(vazio).toEqual([[null]]);

    // O que garante a segurança é que nenhum destes traz o cabeçalho exigido.
    for (const linhas of [texto, vazio]) {
      expect(linhas.flat().filter(Boolean).join('|')).not.toMatch(/UNSPSC/i);
    }
  });
});

describe('Tempo-limite', () => {
  test('um limite impossível de cumprir interrompe a leitura', async () => {
    // Com 1 ms nem o isolado chega a arrancar, e é esse o ponto: prova-se que o
    // cronómetro dispara, mata o worker e devolve a mensagem certa. Provocar um
    // ReDoS verdadeiro exigiria guardar em repositório um ficheiro construído
    // para atacar o parser, o que é pior do que o que se ganhava.
    jest.resetModules();
    process.env.XLSX_TIMEOUT_MS = '1';
    const comLimiteCurto = require('../src/services/xlsxSeguro');
    expect(comLimiteCurto.TEMPO_LIMITE_MS).toBe(1);

    const buf = construir([['A']]);
    await expect(comLimiteCurto.lerLinhas(buf, [])).rejects.toThrow(/demorou demasiado tempo/i);

    delete process.env.XLSX_TIMEOUT_MS;
    jest.resetModules();
  });

  test('o tempo-limite por omissão dá folga sobre o maior ficheiro aceite', () => {
    // 25 MB é o máximo do upload; um catálogo real desse tamanho lê-se em ~3,4 s.
    // Se alguém apertar isto para perto disso, importações legítimas começam a
    // falhar de forma intermitente — que é a maneira mais difícil de investigar.
    expect(xlsxSeguro.TEMPO_LIMITE_MS).toBeGreaterThanOrEqual(15_000);
  });
});

describe('Tecto de memória', () => {
  test('memória esgotada é dita como tal, e não como ficheiro inválido', () => {
    // Este é o ramo que a medição corrigiu. Bater no tecto chega ao evento
    // 'error' com este código — NÃO a um 'exit' silencioso, como a leitura da
    // documentação sugere. Enquanto isto esteve trocado, quem enviava um
    // ficheiro válido mas grande de mais era mandado verificar se o ficheiro
    // era válido.
    expect(xlsxSeguro.mensagemDeErro({ code: 'ERR_WORKER_OUT_OF_MEMORY' }))
      .toBe(xlsxSeguro.GRANDE_DEMAIS);
    expect(xlsxSeguro.mensagemDeErro(new Error('qualquer outra coisa')))
      .toBe(xlsxSeguro.ILEGIVEL);
    expect(xlsxSeguro.mensagemDeErro(undefined)).toBe(xlsxSeguro.ILEGIVEL);
  });

  test('o tecto trava mesmo o isolado — verificado fora do Jest', () => {
    // PORQUE É QUE ISTO CORRE NOUTRO PROCESSO. O contentor de desenvolvimento
    // define NODE_OPTIONS=--max-old-space-size=8192, e essa variável ANULA em
    // silêncio o `resourceLimits` do worker: com ela, o isolado aloca gigabytes
    // sem se queixar e este teste passaria sem nada estar a ser contido.
    //
    // Só se prova que o limite existe correndo sem ela. É também a razão de o
    // teste valer a pena: sem ele, a diferença entre "contido" e "a fingir que
    // contém" não aparece em lado nenhum.
    const script = `
      process.env.XLSX_MEMORIA_MB = '32';
      const XLSX = require('xlsx');
      const seguro = require('${path.join(__dirname, '..', 'src', 'services', 'xlsxSeguro.js')}');
      const linhas = [];
      for (let i = 0; i < 40000; i++) linhas.push(['texto de preenchimento numero ' + i, i, 'x'.repeat(80)]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(linhas), 'Catálogo');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      seguro.lerLinhas(buf, ['catálogo'])
        .then(() => console.log('LEU'))
        .catch((e) => console.log('BLOQUEOU:' + e.message));
    `;
    const saida = execFileSync(process.execPath, ['-e', script], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, NODE_OPTIONS: '' },
      encoding: 'utf8',
      timeout: 120_000,
    });

    expect(saida).toContain('BLOQUEOU');
    expect(saida).toContain('demasiado grande');
  }, 150_000);
});
