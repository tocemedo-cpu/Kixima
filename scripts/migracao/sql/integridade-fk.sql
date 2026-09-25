-- Órfãos: linhas cuja FK aponta a um pai que não existe. Deve devolver 0 linhas.
-- (Um restore com pg_restore recria as FKs no fim; se alguma falhou, os órfãos
-- aparecem aqui.) Só leitura. Gera uma consulta por FK de coluna única.
SELECT
  fk.table_name,
  fk.constraint_name,
  fk.columns,
  fk.referenced_table,
  (xpath('/row/c/text()', query_to_xml(format(
     'SELECT count(*) AS c FROM %I t LEFT JOIN %I r ON t.%I = r.%I WHERE t.%I IS NOT NULL AND r.%I IS NULL',
     fk.table_name, fk.referenced_table, fk.columns, fk.referenced_columns, fk.columns, fk.referenced_columns),
     false, true, '')))[1]::text::bigint AS orphan_rows
FROM (
  SELECT
    c.conrelid::regclass::text AS table_name,
    c.conname AS constraint_name,
    c.confrelid::regclass::text AS referenced_table,
    (SELECT a.attname FROM pg_attribute a WHERE a.attrelid = c.conrelid AND a.attnum = c.conkey[1]) AS columns,
    (SELECT a.attname FROM pg_attribute a WHERE a.attrelid = c.confrelid AND a.attnum = c.confkey[1]) AS referenced_columns
  FROM pg_constraint c
  JOIN pg_namespace n ON n.oid = c.connamespace
  WHERE n.nspname = 'public' AND c.contype = 'f' AND array_length(c.conkey, 1) = 1
) fk
ORDER BY 5 DESC, 1, 2;
