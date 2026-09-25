-- Extensões instaladas (as migrações do KIXIMA exigem pg_trgm). Só leitura.
SELECT e.extname AS extension, e.extversion AS version, n.nspname AS schema
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
ORDER BY e.extname;
