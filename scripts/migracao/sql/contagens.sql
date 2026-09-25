-- Contagem EXACTA de linhas de todas as tabelas do esquema public.
-- O mesmo ficheiro corre na ORIGEM (Supabase) e no DESTINO; o 05-comparar-registos.ps1
-- cruza os dois. Só leitura.
--
-- Na origem (Windows PowerShell; a password vai em PGPASSWORD, nunca na linha):
--   $env:PGPASSWORD = "<password>"
--   psql -X --csv -h aws-0-<regiao>.pooler.supabase.com -p 5432 -U postgres.<ref> -d postgres `
--        -f scripts\migracao\sql\contagens.sql > backup\contagens-origem.csv
--
-- Usa query_to_xml para obter count(*) real de cada tabela numa só instrução
-- (pg_class.reltuples é só uma estimativa).
SELECT
  t.table_name,
  (xpath('/row/c/text()',
         query_to_xml(format('SELECT count(*) AS c FROM %I.%I', t.table_schema, t.table_name), false, true, '')))[1]::text::bigint AS row_count
FROM information_schema.tables t
WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name;
