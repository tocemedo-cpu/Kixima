-- Contador atómico de referências (PO-2026-000123, FAT-…, SD-…).
--
-- O número saía de um COUNT das linhas existentes, o que falha de duas maneiras:
--   1) não é atómico — dois pedidos simultâneos contam o mesmo valor, geram a
--      mesma referência e o segundo rebenta com conflito (409 ao comprador);
--   2) desfaz-se com qualquer eliminação — o número libertado é reatribuído a
--      uma referência que já existe.
--
-- Passa a ser incrementado pela base de dados, atomicamente, e nunca recua.
--
-- Idempotente: pode ser corrido mais do que uma vez sem erro.

CREATE TABLE IF NOT EXISTS "reference_counters" (
    "key"   TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "reference_counters_pkey" PRIMARY KEY ("key")
);

-- Arranca cada contador no MAIOR número já emitido, para não repetir nenhuma
-- referência existente. A largura do número NÃO é fixa: há referências antigas
-- com 5 dígitos e novas com 6, por isso lê-se o que vem depois do último hífen.
INSERT INTO "reference_counters" ("key", "value")
SELECT prefixo_ano, MAX(seq)
  FROM (
    SELECT SUBSTRING("reference" FROM '^(.*)-[0-9]+$')          AS prefixo_ano,
           CAST(SUBSTRING("reference" FROM '([0-9]+)$') AS INTEGER) AS seq
      FROM "purchase_orders"
     WHERE "reference" ~ '^[A-Z]+-[0-9]{4}-[0-9]+$'
    UNION ALL
    SELECT SUBSTRING("reference" FROM '^(.*)-[0-9]+$'),
           CAST(SUBSTRING("reference" FROM '([0-9]+)$') AS INTEGER)
      FROM "invoices"
     WHERE "reference" ~ '^[A-Z]+-[0-9]{4}-[0-9]+$'
  ) AS existentes
 GROUP BY prefixo_ano
    ON CONFLICT ("key") DO NOTHING;
