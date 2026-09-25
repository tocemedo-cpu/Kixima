-- Sobe cada contador de reference_counters para o maior número já usado na
-- tabela correspondente (nunca o desce). Só corre pelo
-- 06-sincronizar-sequences.ps1 -Aplicar, depois de ver o relatório.
DO $$
DECLARE
  a RECORD;
  r RECORD;
BEGIN
  FOR a IN
    SELECT * FROM (VALUES ('PO','purchase_orders','reference'), ('FAT','invoices','reference'),
                          ('NC','credit_notes','reference'), ('CTR','contracts','reference'),
                          ('SD','supplier_dev_requests','reference'), ('SUB','plano_cobrancas','referencia'),
                          ('ADD','addon_cobrancas','referencia')) AS v(prefixo, tabela, coluna)
  LOOP
    FOR r IN EXECUTE format(
      'SELECT regexp_replace(%I, ''-[0-9]+$'', '''') AS chave, max(NULLIF(regexp_replace(%I, ''^.*-'', ''''), '''')::bigint) AS maximo
         FROM public.%I WHERE %I ~ ''^%s-[0-9]{4}-[0-9]+$'' GROUP BY 1',
      a.coluna, a.coluna, a.tabela, a.coluna, a.prefixo)
    LOOP
      INSERT INTO reference_counters ("key", "value") VALUES (r.chave, r.maximo)
      ON CONFLICT ("key") DO UPDATE SET "value" = GREATEST(reference_counters."value", EXCLUDED."value");
      RAISE NOTICE 'contador %: >= %', r.chave, r.maximo;
    END LOOP;
  END LOOP;
END $$;
