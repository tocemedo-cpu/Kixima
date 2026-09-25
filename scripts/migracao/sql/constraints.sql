-- PK, FK, UNIQUE e CHECK do esquema public, com colunas e a tabela referenciada. Só leitura.
SELECT
  c.conrelid::regclass::text                    AS table_name,
  c.conname                                     AS constraint_name,
  CASE c.contype WHEN 'p' THEN 'PRIMARY KEY' WHEN 'f' THEN 'FOREIGN KEY'
                 WHEN 'u' THEN 'UNIQUE' WHEN 'c' THEN 'CHECK' WHEN 'x' THEN 'EXCLUDE' END AS constraint_type,
  (SELECT string_agg(a.attname, ',' ORDER BY k.ord)
     FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
     JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum) AS columns,
  CASE WHEN c.contype = 'f' THEN c.confrelid::regclass::text END AS referenced_table,
  CASE WHEN c.contype = 'f' THEN
    (SELECT string_agg(a.attname, ',' ORDER BY k.ord)
       FROM unnest(c.confkey) WITH ORDINALITY AS k(attnum, ord)
       JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.attnum) END AS referenced_columns,
  CASE WHEN c.contype = 'f' THEN
    CASE c.confdeltype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE'
                       WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' END END AS on_delete,
  c.convalidated                                AS validated
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE n.nspname = 'public'
ORDER BY 1, 3, 2;
