-- Contadores de referência do KIXIMA (backend/src/utils/reference.js).
-- Não são sequences: a tabela reference_counters guarda, por prefixo+ano
-- (ex.: 'PO-2026'), o último número emitido; a próxima referência é value+1,
-- gerada de forma atómica por UPSERT. Depois do restore o contador tem de ser
-- >= ao maior número já usado nessa tabela, senão a próxima referência colide
-- com uma existente (UNIQUE).
--
-- Mapa prefixo → tabela/coluna (TABELA_DO_MODELO em reference.js):
--   PO  purchase_orders.reference     FAT invoices.reference
--   NC  credit_notes.reference        CTR contracts.reference
--   SD  supplier_dev_requests.reference
--   SUB plano_cobrancas.referencia    ADD addon_cobrancas.referencia
-- Só leitura. status OK quando counter_value >= max_in_table.
WITH maximos AS (
  SELECT regexp_replace(reference, '-[0-9]+$', '') AS chave, 'purchase_orders' AS tabela, 'reference' AS coluna,
         max(NULLIF(regexp_replace(reference, '^.*-', ''), '')::bigint) AS maximo
  FROM purchase_orders WHERE reference ~ '^PO-[0-9]{4}-[0-9]+$' GROUP BY 1
  UNION ALL
  SELECT regexp_replace(reference, '-[0-9]+$', ''), 'invoices', 'reference',
         max(NULLIF(regexp_replace(reference, '^.*-', ''), '')::bigint)
  FROM invoices WHERE reference ~ '^FAT-[0-9]{4}-[0-9]+$' GROUP BY 1
  UNION ALL
  SELECT regexp_replace(reference, '-[0-9]+$', ''), 'credit_notes', 'reference',
         max(NULLIF(regexp_replace(reference, '^.*-', ''), '')::bigint)
  FROM credit_notes WHERE reference ~ '^NC-[0-9]{4}-[0-9]+$' GROUP BY 1
  UNION ALL
  SELECT regexp_replace(reference, '-[0-9]+$', ''), 'contracts', 'reference',
         max(NULLIF(regexp_replace(reference, '^.*-', ''), '')::bigint)
  FROM contracts WHERE reference ~ '^CTR-[0-9]{4}-[0-9]+$' GROUP BY 1
  UNION ALL
  SELECT regexp_replace(reference, '-[0-9]+$', ''), 'supplier_dev_requests', 'reference',
         max(NULLIF(regexp_replace(reference, '^.*-', ''), '')::bigint)
  FROM supplier_dev_requests WHERE reference ~ '^SD-[0-9]{4}-[0-9]+$' GROUP BY 1
  UNION ALL
  SELECT regexp_replace(referencia, '-[0-9]+$', ''), 'plano_cobrancas', 'referencia',
         max(NULLIF(regexp_replace(referencia, '^.*-', ''), '')::bigint)
  FROM plano_cobrancas WHERE referencia ~ '^SUB-[0-9]{4}-[0-9]+$' GROUP BY 1
  UNION ALL
  SELECT regexp_replace(referencia, '-[0-9]+$', ''), 'addon_cobrancas', 'referencia',
         max(NULLIF(regexp_replace(referencia, '^.*-', ''), '')::bigint)
  FROM addon_cobrancas WHERE referencia ~ '^ADD-[0-9]{4}-[0-9]+$' GROUP BY 1
)
SELECT
  COALESCE(rc.key, mx.chave) AS counter_key,
  mx.tabela  AS table_name,
  mx.coluna  AS column_name,
  mx.maximo  AS max_in_table,
  rc.value   AS counter_value,
  CASE WHEN mx.chave IS NULL THEN 'CONTADOR_SEM_LINHAS (inofensivo)'
       WHEN rc.value IS NULL THEN 'SEM_CONTADOR (a app semeia pelo MAX ao primeiro uso)'
       WHEN rc.value >= mx.maximo THEN 'OK'
       ELSE 'DESALINHADO — próxima referência colidiria' END AS status
FROM maximos mx
FULL OUTER JOIN reference_counters rc ON rc.key = mx.chave
ORDER BY 1;
