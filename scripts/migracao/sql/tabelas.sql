-- Tabelas do esquema public com número de colunas, PK e estimativa de linhas. Só leitura.
SELECT
  c.relname                                   AS table_name,
  (SELECT count(*) FROM information_schema.columns col
     WHERE col.table_schema = 'public' AND col.table_name = c.relname) AS columns,
  (SELECT string_agg(a.attname, ',' ORDER BY k.ord)
     FROM pg_constraint p
     JOIN LATERAL unnest(p.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
     JOIN pg_attribute a ON a.attrelid = p.conrelid AND a.attnum = k.attnum
    WHERE p.conrelid = c.oid AND p.contype = 'p')  AS primary_key,
  c.reltuples::bigint                          AS estimated_rows,
  pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;
