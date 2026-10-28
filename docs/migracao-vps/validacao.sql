-- KIXIMA — validação de uma base PostgreSQL (SOMENTE LEITURA).
--
-- Correr contra a kixima_standalone, depois contra o Supabase (pela DIRECT_URL, porta 5432)
-- e, mais tarde, contra a base restaurada no VPS. Guardar cada saída e compará-las com diff.
--
--   psql "host=127.0.0.1 port=5432 dbname=kixima_standalone user=postgres" -X -A -f validacao.sql > validacao_local.txt
--
-- Não escreve nada: só SELECT e SHOW. A senha vem de PGPASSWORD ou do pgpass, nunca da linha de comandos.

\echo === 1. servidor
SELECT version();
SHOW server_encoding;
-- collation e ctype (SHOW lc_collate deixou de existir no PostgreSQL 16+; o catálogo serve em todas as versões)
SELECT datname, datcollate AS lc_collate, datctype AS lc_ctype FROM pg_database WHERE datname = current_database();
SHOW timezone;
SELECT current_database() AS base, pg_size_pretty(pg_database_size(current_database())) AS tamanho;

\echo === 2. extensões instaladas e schema onde vivem (importa: no Supabase o pg_trgm vive em "extensions")
SELECT e.extname, n.nspname AS schema, e.extversion
FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace ORDER BY 1;

\echo === 3. a extensão pg_trgm está disponível neste servidor?
SELECT name, default_version FROM pg_available_extensions WHERE name = 'pg_trgm';

\echo === 4. histórico de migrações do Prisma (esperado: todas com finished_at e sem rolled_back_at)
SELECT count(*) AS total,
       count(*) FILTER (WHERE finished_at IS NULL) AS por_terminar,
       count(*) FILTER (WHERE rolled_back_at IS NOT NULL) AS revertidas
FROM _prisma_migrations;
SELECT migration_name, (finished_at IS NOT NULL) AS terminada, (rolled_back_at IS NOT NULL) AS revertida, applied_steps_count
FROM _prisma_migrations ORDER BY migration_name;
-- checksum registado de cada migração (comparar com o SHA-256 do ficheiro; ver PLANO-MIGRACAO-VPS.md)
SELECT migration_name, checksum FROM _prisma_migrations WHERE migration_name LIKE '202609%' ORDER BY 1;

\echo === 5. linhas por tabela (contagem exata)
SELECT relname AS tabela,
       (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', schemaname, relname), false, true, '')))[1]::text::bigint AS linhas
FROM pg_stat_user_tables WHERE schemaname = 'public' ORDER BY 1;

\echo === 6. actividade mais recente (diz se a base é tão recente como a de produção)
SELECT 'users' AS tabela, max(created_at) AS ultimo FROM users
UNION ALL SELECT 'companies', max(created_at) FROM companies
UNION ALL SELECT 'purchase_orders', max(created_at) FROM purchase_orders
UNION ALL SELECT 'invoices', max(created_at) FROM invoices
UNION ALL SELECT 'credit_notes', max(created_at) FROM credit_notes
UNION ALL SELECT 'conversation_messages', max(created_at) FROM conversation_messages
UNION ALL SELECT 'audit_logs', max(created_at) FROM audit_logs
ORDER BY 1;

\echo === 7. totais financeiros (devem coincidir entre origem e destino)
SELECT count(*) AS faturas, sum(amount) AS soma_faturada FROM invoices;
SELECT count(*) AS pagamentos FROM payments;

\echo === 8. integridade: índices inválidos e tabelas sem chave primária (esperado: 0 linhas)
SELECT indexrelid::regclass AS indice_invalido FROM pg_index WHERE NOT indisvalid;
SELECT c.relname AS sem_chave_primaria
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r' AND n.nspname = 'public'
  AND NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conrelid = c.oid AND k.contype = 'p');

\echo === 9. objetos que só existem em SQL (gatilhos, funções, índices de trigramas) — têm de existir no destino
SELECT tgname AS gatilho, tgrelid::regclass AS tabela FROM pg_trigger WHERE NOT tgisinternal ORDER BY 1;
SELECT proname AS funcao FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' ORDER BY 1;
SELECT indexname, indexdef FROM pg_indexes WHERE indexdef ILIKE '%trgm%' ORDER BY 1;

\echo === 10. ficheiros: quantos URLs ainda apontam para o Supabase Storage (por coluna)
SELECT 'companies.logo_url' AS coluna, count(*) FILTER (WHERE logo_url ILIKE '%supabase%') AS supabase, count(*) FILTER (WHERE logo_url IS NOT NULL) AS total FROM companies
UNION ALL SELECT 'users.avatar_url', count(*) FILTER (WHERE avatar_url ILIKE '%supabase%'), count(*) FILTER (WHERE avatar_url IS NOT NULL) FROM users
UNION ALL SELECT 'products.image_url', count(*) FILTER (WHERE image_url ILIKE '%supabase%'), count(*) FILTER (WHERE image_url IS NOT NULL) FROM products
UNION ALL SELECT 'product_images.url', count(*) FILTER (WHERE url ILIKE '%supabase%'), count(*) FROM product_images
UNION ALL SELECT 'product_documents.file_url', count(*) FILTER (WHERE file_url ILIKE '%supabase%'), count(*) FROM product_documents
UNION ALL SELECT 'company_documents.file_url', count(*) FILTER (WHERE file_url ILIKE '%supabase%'), count(*) FROM company_documents
UNION ALL SELECT 'payments.proof_url', count(*) FILTER (WHERE proof_url ILIKE '%supabase%'), count(*) FILTER (WHERE proof_url IS NOT NULL) FROM payments
UNION ALL SELECT 'plano_cobrancas.comprovativo_url', count(*) FILTER (WHERE comprovativo_url ILIKE '%supabase%'), count(*) FILTER (WHERE comprovativo_url IS NOT NULL) FROM plano_cobrancas
UNION ALL SELECT 'addon_cobrancas.comprovativo_url', count(*) FILTER (WHERE comprovativo_url ILIKE '%supabase%'), count(*) FILTER (WHERE comprovativo_url IS NOT NULL) FROM addon_cobrancas
UNION ALL SELECT 'supplier_to_kixima_policies.document_url', count(*) FILTER (WHERE document_url ILIKE '%supabase%'), count(*) FILTER (WHERE document_url IS NOT NULL) FROM supplier_to_kixima_policies
UNION ALL SELECT 'support_category_images.image_url', count(*) FILTER (WHERE image_url ILIKE '%supabase%'), count(*) FROM support_category_images
UNION ALL SELECT 'support_messages.attachment_url', count(*) FILTER (WHERE attachment_url ILIKE '%supabase%'), count(*) FILTER (WHERE attachment_url IS NOT NULL) FROM support_messages
UNION ALL SELECT 'conversation_messages.attachment_url', count(*) FILTER (WHERE attachment_url ILIKE '%supabase%'), count(*) FILTER (WHERE attachment_url IS NOT NULL) FROM conversation_messages;
-- URLs locais (/api/uploads/...) — estes ficheiros estão no disco de um contentor e podem já ter-se perdido:
SELECT 'ficheiros em /api/uploads/ (disco local)' AS nota,
       (SELECT count(*) FROM company_documents WHERE file_url LIKE '/api/uploads/%')
     + (SELECT count(*) FROM payments WHERE proof_url LIKE '/api/uploads/%')
     + (SELECT count(*) FROM products WHERE image_url LIKE '/api/uploads/%') AS total;
