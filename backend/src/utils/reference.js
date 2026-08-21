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
// Tabelas onde vivem as referências, por modelo. O nome da tabela não se pode
// interpolar a partir do modelo sem abrir uma porta a SQL injection, por isso é
// uma lista fechada: um modelo que não esteja aqui não é aceite.
const TABELA_DO_MODELO = {
  purchaseOrder: { tabela: 'purchase_orders', coluna: 'reference' },
  invoice: { tabela: 'invoices', coluna: 'reference' },
  contract: { tabela: 'contracts', coluna: 'reference' },
  supplierDevRequest: { tabela: 'supplier_dev_requests', coluna: 'reference' },
  planoCobranca: { tabela: 'plano_cobrancas', coluna: 'referencia' },
  creditNote: { tabela: 'credit_notes', coluna: 'reference' },
};

/**
 * O maior número já emitido com este prefixo e ano.
 *
 * Calculado PELA BASE, com um único valor de volta. Antes lia-se a tabela toda
 * para memória e ordenava-se em JavaScript — ordenar por texto não serve,
 * porque "PO-2026-9" ficaria depois de "PO-2026-000010", e por isso era preciso
 * converter tudo a número.
 *
 * Além de ser um leitura sem tecto (a tabela cresce para sempre), isso tornou-se
 * perigoso quando passou a haver um limite por omissão nas consultas: uma leitura
 * truncada devolveria um máximo mais baixo do que o real, e a referência
 * seguinte colidiria com uma que já existe. Aqui não há nada para truncar.
 */
async function seedValue(prefix, counterModel, year, campo) {
  const alvo = TABELA_DO_MODELO[counterModel];
  if (!alvo) {
    throw new Error(
      `Modelo "${counterModel}" não está registado em TABELA_DO_MODELO (src/utils/reference.js). `
      + 'Acrescente-o antes de gerar referências para ele.',
    );
  }
  if (alvo.coluna !== campo) {
    throw new Error(`Campo "${campo}" não corresponde à coluna registada para ${counterModel}.`);
  }

  // Identificadores vêm da lista fechada acima, nunca do exterior; o prefixo e
  // o ano vão como parâmetros.
  const sql = `
    SELECT COALESCE(MAX(NULLIF(regexp_replace("${alvo.coluna}", '^.*-', ''), '')::bigint), 0) AS max
    FROM "${alvo.tabela}"
    WHERE "${alvo.coluna}" LIKE $1
      AND "${alvo.coluna}" ~ '-[0-9]+$'
  `;
  const [{ max }] = await prisma.$queryRawUnsafe(sql, `${prefix}-${year}-%`);
  return Number(max) || 0;
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
