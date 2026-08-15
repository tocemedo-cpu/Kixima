// src/utils/paginacao.js
// Paginação com a CONTAGEM TOTAL sempre à frente.
//
// O problema que isto resolve não é "as listas são grandes" — é que havia
// tectos fixos a esconder linhas sem o dizer. As notificações paravam nas 50 e
// os movimentos de stock nas 200; quem tivesse mais via a lista cheia, sem
// nada a indicar que faltava alguma coisa. Uma lista truncada em silêncio é
// pior do que uma lista que não abre: quem a lê toma decisões com ela.
//
// Por isso o envelope leva SEMPRE o `total`. É esse número que permite à
// interface dizer "25 de 340" em vez de mostrar 25 e deixar acreditar que são
// todas. O `take` cego em config/database.js continua a existir como rede de
// segurança para o que ainda não está paginado, e grita quando é atingido —
// aqui a intenção é não chegar lá.

const POR_OMISSAO = 25;
const MAXIMO = 100;

/**
 * Converte `?page=&limit=` em algo que o Prisma aceita.
 *
 * Valores absurdos não rebentam nem passam: um `limit=100000` seria um pedido
 * para carregar a tabela toda para memória a partir do exterior, e é
 * exatamente o que o tecto existe para impedir. Um `page=-3` volta à primeira.
 */
function parametros({ page, limit } = {}) {
  const pagina = Math.max(1, Math.floor(Number(page)) || 1);
  const pedido = Math.floor(Number(limit));
  const porPagina = Number.isFinite(pedido) && pedido > 0
    ? Math.min(MAXIMO, pedido)
    : POR_OMISSAO;
  return { pagina, porPagina, skip: (pagina - 1) * porPagina, take: porPagina };
}

/**
 * O envelope de resposta. Nome dos campos em português, como o resto do
 * domínio desta aplicação.
 */
function envelope(itens, total, { pagina, porPagina }) {
  return {
    itens,
    total,
    pagina,
    porPagina,
    paginas: Math.max(1, Math.ceil(total / porPagina)),
  };
}

module.exports = { parametros, envelope, POR_OMISSAO, MAXIMO };
