// src/config/database.js
// Instância única do Prisma Client. Todo o resto do código deve importar
// a base de dados a partir daqui, nunca instanciar PrismaClient noutro sítio.

const { PrismaClient } = require('@prisma/client');
const config = require('./env');
const logger = require('./logger');

// --- Tecto por omissão nas leituras em lista --------------------------------
//
// O PROBLEMA: dezenas de findMany sem limite. Com dez empresas não se nota; com
// duzentas e catálogos grandes, uma listagem carrega tudo para memória e mata o
// processo — e mata-o para toda a gente, não só para quem fez o pedido. O
// contentor tem 512 MB.
//
// A ARMADILHA DA SOLUÇÃO ÓBVIA: pôr um `take` cego em todas as consultas troca
// um crash por uma coisa pior — resultados truncados em silêncio. Nove serviços
// desta aplicação somam valores sobre estas leituras; um relatório financeiro
// que devolve um total mais baixo do que o verdadeiro, sem se queixar, é muito
// pior do que um relatório que não abre.
//
// A RESOLUÇÃO: o tecto é alto (é uma rede de segurança, não paginação — a
// paginação a sério continua onde já estava) e, quando chega a ser atingido,
// GRITA. Uma leitura truncada passa a deixar rasto com o modelo e a contagem,
// em vez de devolver um número errado com ar de certo.
//
// Quem precisa mesmo de tudo passa um `take` explícito e fica responsável por
// ele — a decisão fica escrita no sítio onde é tomada.
const TETO_POR_OMISSAO = Number(process.env.DB_MAX_ROWS) || 1000;

// Modelos onde o tecto NÃO se aplica: leituras pequenas por natureza e usadas
// em contas que têm de estar certas. Ficam aqui, à vista, e não espalhadas.
const SEM_TECTO = new Set(['referenceCounter']);

const base = new PrismaClient({
  log: config.isDevelopment ? ['warn', 'error'] : ['error'],
});

const prisma = base.$extends({
  query: {
    $allModels: {
      async findMany({ model, args, query }) {
        if (args.take !== undefined || SEM_TECTO.has(model)) return query(args);

        const resultado = await query({ ...args, take: TETO_POR_OMISSAO });

        // Chegou exatamente ao tecto: quase de certeza foi cortado. Não se
        // esconde — é este aviso que impede o tecto de se tornar uma fonte de
        // números errados.
        if (Array.isArray(resultado) && resultado.length === TETO_POR_OMISSAO) {
          logger.error(
            `Leitura de ${model} atingiu o tecto de ${TETO_POR_OMISSAO} linhas e foi truncada. `
            + 'Qualquer total calculado a partir daqui está ERRADO. '
            + 'Acrescente paginação a este endpoint ou um take explícito.',
            { modelo: model, onde: origemDaChamada() },
          );
        }
        return resultado;
      },
    },
  },
});

// A linha do código que fez a consulta. Sem isto o aviso diz que "purchaseOrder
// foi truncado" e deixa quem o lê à procura em dezoito sítios diferentes.
function origemDaChamada() {
  const linhas = String(new Error().stack || '').split('\n');
  return linhas.find((l) => l.includes('/src/') && !l.includes('config/database.js'))?.trim() || null;
}

module.exports = prisma;
module.exports.TETO_POR_OMISSAO = TETO_POR_OMISSAO;
