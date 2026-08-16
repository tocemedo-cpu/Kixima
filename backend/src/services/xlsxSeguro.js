// src/services/xlsxSeguro.js
// A fronteira à volta da leitura de Excel.
//
// Ver src/workers/lerXlsx.js para o porquê de haver um isolado. Aqui está o
// lado de fora: os limites que o tornam eficaz.
//
// SEM TEMPO-LIMITE, O ISOLADO NÃO SERVE DE NADA. Um worker preso continua preso
// para sempre, e ao fim de alguns ficheiros construídos a plataforma tem um
// punhado de threads bloqueadas a consumir memória num contentor de 512 MB. O
// isolamento só conta como contenção quando existe quem o mate.

const path = require('path');
const { Worker } = require('worker_threads');
const { BusinessRuleError } = require('../utils/errors');
const logger = require('../config/logger');

// Os dois números abaixo foram MEDIDOS, não escolhidos a olho. O maior ficheiro
// que o upload deixa passar são 25 MB (ver src/config/upload.js); um catálogo
// real desse tamanho — 48 000 linhas de onze colunas — lê-se em 3,4 segundos e
// chega aos 170 MB de heap. É essa a medida de que ambos os limites se afastam.

// Trinta segundos: cerca de nove vezes o pior caso legítimo. Um catálogo grande
// lê-se em segundos; o que passa disto está preso, não está a trabalhar.
const TEMPO_LIMITE_MS = Number(process.env.XLSX_TIMEOUT_MS) || 30_000;

// Tecto de memória do isolado, com folga de ~1,5x sobre esses 170 MB. O que
// trava não é o ficheiro — é o que ele se torna depois de aberto: uma folha
// declarada com um milhão de linhas vazias ocupa muito mais do que os poucos
// KB que a descrevem.
//
// ATENÇÃO A QUEM FOR MEXER: este tecto é silenciosamente anulado se o processo
// correr com NODE_OPTIONS=--max-old-space-size. O contentor de desenvolvimento
// desta plataforma define exatamente isso, e enquanto lá estiver o isolado
// aceita alocar gigabytes sem se queixar. Em produção a variável não existe
// (não está no Dockerfile nem na configuração do Render) e o limite aplica-se.
const MEMORIA_MB = Number(process.env.XLSX_MEMORIA_MB) || 256;

const CAMINHO = path.join(__dirname, '..', 'workers', 'lerXlsx.js');

const ILEGIVEL = 'Não foi possível ler o ficheiro Excel. Verifique se é um .xlsx válido.';
const GRANDE_DEMAIS = 'O ficheiro é demasiado grande para ser processado. Divida-o em partes menores.';

/**
 * Traduz a falha do isolado na frase que a pessoa vai ler.
 *
 * Está à parte por uma razão prática: o caminho da memória esgotada não se
 * consegue provocar dentro do Jest deste contentor (ver a nota em MEMORIA_MB),
 * e uma decisão que não se consegue testar é uma decisão que se estraga sem
 * ninguém dar por isso.
 */
function mensagemDeErro(err) {
  return err && err.code === 'ERR_WORKER_OUT_OF_MEMORY' ? GRANDE_DEMAIS : ILEGIVEL;
}

/**
 * Lê as linhas de uma folha. Devolve `string[][]`.
 *
 * @param buffer        conteúdo do ficheiro
 * @param nomesDeFolha  nomes aceites, em minúsculas; a primeira folha serve de
 *                      alternativa quando nenhum bate
 */
function lerLinhas(buffer, nomesDeFolha = []) {
  return new Promise((resolve, reject) => {
    let terminado = false;
    const worker = new Worker(CAMINHO, {
      workerData: { buffer, nomesDeFolha },
      resourceLimits: { maxOldGenerationSizeMb: MEMORIA_MB },
    });

    const fechar = () => { worker.terminate().catch(() => {}); };

    const cronometro = setTimeout(() => {
      if (terminado) return;
      terminado = true;
      fechar();
      // Não se diz ao utilizador "a sua folha tem uma expressão regular
      // maliciosa": na esmagadora maioria dos casos é um ficheiro grande de
      // mais ou corrompido, e a mensagem tem de servir esse caso.
      logger.error('Leitura de Excel abortada por tempo-limite', { ms: TEMPO_LIMITE_MS });
      reject(new BusinessRuleError(
        'O ficheiro demorou demasiado tempo a ser lido e foi interrompido. '
        + 'Verifique se é um .xlsx válido e tente com menos linhas de cada vez.',
      ));
    }, TEMPO_LIMITE_MS);

    worker.on('message', (msg) => {
      if (terminado) return;
      terminado = true;
      clearTimeout(cronometro);
      fechar();
      if (msg.ok) return resolve(msg.linhas);
      if (msg.erro === 'VAZIO') return resolve([]);
      return reject(new BusinessRuleError(ILEGIVEL));
    });

    worker.on('error', (err) => {
      if (terminado) return;
      terminado = true;
      clearTimeout(cronometro);

      // Bater no tecto de memória chega AQUI, e não ao 'exit' — foi medido, e
      // não é o que se supõe ao ler a documentação. O V8 abate o isolado e o
      // Node traduz isso num evento de erro com este código estável.
      //
      // A distinção não é cosmética: dizer "verifique se é um .xlsx válido" a
      // quem enviou um ficheiro perfeitamente válido, mas grande de mais,
      // manda a pessoa procurar um problema que não existe.
      logger.error('Leitura de Excel falhou no isolado', { erro: err.message, codigo: err.code });
      reject(new BusinessRuleError(mensagemDeErro(err)));
    });

    worker.on('exit', () => {
      // Rede de segurança: o isolado terminou sem mensagem, sem erro e sem
      // tempo-limite. Não se conhece caminho que chegue aqui, mas ficar
      // pendurado para sempre seria pior do que uma mensagem genérica.
      if (terminado) return;
      terminado = true;
      clearTimeout(cronometro);
      reject(new BusinessRuleError(ILEGIVEL));
    });
  });
}

module.exports = {
  lerLinhas, mensagemDeErro, TEMPO_LIMITE_MS, MEMORIA_MB, ILEGIVEL, GRANDE_DEMAIS,
};
