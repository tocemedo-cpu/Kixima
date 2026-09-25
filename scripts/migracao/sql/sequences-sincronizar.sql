-- Alinha TODAS as sequences do esquema public com o MAX da coluna que as usa:
-- setval(seq, max(coluna)) quando há linhas; setval(seq, 1, false) quando a
-- tabela está vazia (a próxima inserção dá 1). Não converte nada para UUID e
-- não toca em dados — só no estado das sequences.
--
-- Corre pelo 06-sincronizar-sequences.ps1 -Aplicar. No KIXIMA não há sequences
-- (chaves UUID), por isso o bloco normalmente termina sem fazer nada.
DO $$
DECLARE
  r RECORD;
  maximo BIGINT;
BEGIN
  FOR r IN
    SELECT seq.sequencename, dep_tab.relname AS table_name, dep_att.attname AS column_name
    FROM pg_sequences seq
    JOIN pg_class sc ON sc.relname = seq.sequencename
    JOIN pg_namespace sn ON sn.oid = sc.relnamespace AND sn.nspname = seq.schemaname
    JOIN pg_depend d ON d.objid = sc.oid AND d.deptype = 'a'
    JOIN pg_class dep_tab ON dep_tab.oid = d.refobjid
    JOIN pg_attribute dep_att ON dep_att.attrelid = d.refobjid AND dep_att.attnum = d.refobjsubid
    WHERE seq.schemaname = 'public'
  LOOP
    EXECUTE format('SELECT max(%I) FROM public.%I', r.column_name, r.table_name) INTO maximo;
    IF maximo IS NULL THEN
      PERFORM setval(format('public.%I', r.sequencename), 1, false);
      RAISE NOTICE 'sequence % (%.%): tabela vazia, próximo valor 1', r.sequencename, r.table_name, r.column_name;
    ELSE
      PERFORM setval(format('public.%I', r.sequencename), maximo, true);
      RAISE NOTICE 'sequence % (%.%): alinhada com MAX=%, próximo valor %', r.sequencename, r.table_name, r.column_name, maximo, maximo + 1;
    END IF;
  END LOOP;
END $$;
