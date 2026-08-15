// src/utils/reference.js
// Gera referências legíveis (PO-2026-000123) com contagem ATÓMICA por prefixo+ano.
//
// Antes o número saía de um COUNT das linhas existentes, o que falhava de duas
// maneiras:
//   1) não é atómico — dois pedidos simultâneos contam o mesmo valor e geram a
//      MESMA referência; a segunda gravação rebenta com conflito, e o comprador
//      leva um 409 ao fechar a cesta;
//   2) desfaz-se com qualquer eliminação — o número libertado volta a ser
//      atribuído, colidindo com uma referência que já existe.
//
// Agora o valor é incrementado pela própria base de dados (UPDATE … RETURNING),
// numa única instrução, e nunca recua.
const prisma = require('../config/database');

// Primeiro uso de um contador: arranca no maior número já emitido nessa tabela,
// para não repetir referências criadas antes de existir contador.
async function seedValue(prefix, counterModel, year, campo) {
  // Ordenar por texto não serve quando há larguras diferentes ("PO-2026-9"
  // ficaria depois de "PO-2026-000010"): procura-se o máximo NUMÉRICO.
  const emitidas = await prisma[counterModel].findMany({
    where: { [campo]: { startsWith: `${prefix}-${year}-` } },
    select: { [campo]: true },
  });
  const ultimo = emitidas
    .map((r) => Number(String(r[campo]).split('-').pop()))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => b - a)[0];
  return ultimo > 0 ? ultimo : 0;
}

/**
 * @param campo Nome do campo que guarda a referência no modelo. Os modelos
 *   antigos chamam-lhe `reference`; os novos (em português) `referencia`. O
 *   nome tem de vir de fora porque a semente lê o maior número JÁ EMITIDO — a
 *   ler o campo errado, arrancaria do 1 e colidiria com referências existentes.
 */
async function nextReference(prefix, counterModel, campo = 'reference') {
  const year = new Date().getFullYear();
  const key = `${prefix}-${year}`;

  // O INSERT só ganha na primeiríssima vez; a partir daí é sempre o DO UPDATE
  // que incrementa. As duas metades correm numa instrução — se dois pedidos
  // chegarem juntos, um insere e o outro incrementa, e saem números distintos.
  const inicial = (await seedValue(prefix, counterModel, year, campo)) + 1;
  const [{ value }] = await prisma.$queryRaw`
    INSERT INTO "reference_counters" ("key", "value")
    VALUES (${key}, ${inicial})
    ON CONFLICT ("key") DO UPDATE SET "value" = "reference_counters"."value" + 1
    RETURNING "value"
  `;

  return `${prefix}-${year}-${String(value).padStart(6, '0')}`;
}

module.exports = { nextReference };
