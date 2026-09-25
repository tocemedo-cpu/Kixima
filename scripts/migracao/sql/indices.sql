-- Índices do esquema public (inclui os de PK/UNIQUE) com a definição completa. Só leitura.
SELECT
  i.tablename  AS table_name,
  i.indexname  AS index_name,
  ix.indisunique  AS is_unique,
  ix.indisprimary AS is_primary,
  ix.indisvalid   AS is_valid,
  i.indexdef   AS definition
FROM pg_indexes i
JOIN pg_class c   ON c.relname = i.indexname
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = i.schemaname
JOIN pg_index ix  ON ix.indexrelid = c.oid
WHERE i.schemaname = 'public'
ORDER BY i.tablename, i.indexname;
