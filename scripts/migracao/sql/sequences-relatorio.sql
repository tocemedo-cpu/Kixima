-- Relatório de TODAS as sequences do esquema public: tabela/coluna dona, MAX(coluna),
-- last_value e o PRÓXIMO valor que a sequence vai dar. Só leitura.
--
-- Nota KIXIMA: o schema.prisma usa UUID em todas as chaves (nenhum serial/identity),
-- por isso é normal este relatório vir VAZIO. Fica obrigatório na mesma: se alguma
-- sequence existir (extensão, coluna adicionada à mão), tem de ficar alinhada.
-- Os contadores de referência (PO-2026-000123 …) não são sequences: são a
-- tabela reference_counters — ver reference-counters.sql.
--
-- status: OK quando next_value > MAX(coluna); DESALINHADA quando a próxima
-- inserção colidiria com uma linha existente (corrigir com sequences-sincronizar.sql).
WITH s AS (
  SELECT
    seq.schemaname, seq.sequencename,
    dep_tab.relname  AS table_name,
    dep_att.attname  AS column_name,
    seq.last_value, seq.increment_by, seq.start_value,
    pg_sequence_last_value((seq.schemaname || '.' || quote_ident(seq.sequencename))::regclass) AS lv
  FROM pg_sequences seq
  JOIN pg_class sc ON sc.relname = seq.sequencename
  JOIN pg_namespace sn ON sn.oid = sc.relnamespace AND sn.nspname = seq.schemaname
  LEFT JOIN pg_depend d ON d.objid = sc.oid AND d.deptype = 'a'
  LEFT JOIN pg_class dep_tab ON dep_tab.oid = d.refobjid
  LEFT JOIN pg_attribute dep_att ON dep_att.attrelid = d.refobjid AND dep_att.attnum = d.refobjsubid
  WHERE seq.schemaname = 'public'
)
SELECT
  s.sequencename AS sequence_name,
  s.table_name,
  s.column_name,
  CASE WHEN s.table_name IS NOT NULL THEN
    (xpath('/row/m/text()', query_to_xml(format('SELECT max(%I)::text AS m FROM %I.%I', s.column_name, s.schemaname, s.table_name), false, true, '')))[1]::text::bigint
  END AS max_id,
  s.last_value,
  CASE WHEN s.last_value IS NULL THEN s.start_value ELSE s.last_value + s.increment_by END AS next_value,
  CASE
    WHEN s.table_name IS NULL THEN 'SEM_TABELA'
    WHEN COALESCE((xpath('/row/m/text()', query_to_xml(format('SELECT max(%I)::text AS m FROM %I.%I', s.column_name, s.schemaname, s.table_name), false, true, '')))[1]::text::bigint, 0)
         < CASE WHEN s.last_value IS NULL THEN s.start_value ELSE s.last_value + s.increment_by END THEN 'OK'
    ELSE 'DESALINHADA'
  END AS status
FROM s
ORDER BY s.sequencename;
