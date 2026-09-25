-- Tipos enumerados do esquema public com os valores pela ordem de definição. Só leitura.
-- schema.prisma declara 36 enums.
SELECT
  t.typname AS enum_name,
  count(e.enumlabel) AS values_count,
  string_agg(e.enumlabel, '|' ORDER BY e.enumsortorder) AS values
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
JOIN pg_enum e ON e.enumtypid = t.oid
WHERE n.nspname = 'public' AND t.typtype = 'e'
GROUP BY t.typname
ORDER BY t.typname;
