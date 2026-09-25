-- Colunas NOT NULL (e valores por omissão) de todas as tabelas do esquema public. Só leitura.
-- Serve para comparar origem e destino coluna a coluna (o mesmo ficheiro corre nos dois).
SELECT
  table_name,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default,
  character_maximum_length,
  numeric_precision,
  numeric_scale
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;
