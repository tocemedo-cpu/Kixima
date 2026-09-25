-- Funções, triggers e vistas do esquema public. Só leitura.
-- Esperado (migrações 20260831000000_pesquisa_sem_acentos e 20260831010000_pesquisa_fornecedor):
--   funções  kixima_normalizar, products_search_text, companies_search_text
--   triggers products_search_text_trg (products), companies_search_text_trg (companies)
--   vistas   nenhuma
SELECT 'FUNCTION' AS kind, p.proname AS name, NULL::text AS on_table, l.lanname AS language,
       pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_language l ON l.oid = p.prolang
WHERE n.nspname = 'public'
UNION ALL
SELECT 'TRIGGER', t.tgname, t.tgrelid::regclass::text, NULL, pg_get_triggerdef(t.oid)
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND NOT t.tgisinternal
UNION ALL
SELECT 'VIEW', v.viewname, NULL, NULL, NULL
FROM pg_views v WHERE v.schemaname = 'public'
ORDER BY 1, 2;
