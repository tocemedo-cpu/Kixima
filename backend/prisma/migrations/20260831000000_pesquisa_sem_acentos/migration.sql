-- Pesquisa que encontra o que existe.
--
-- Até aqui a pesquisa era `ILIKE '%termo%'` sobre seis colunas, sem índice.
-- Duas avarias, e nenhuma dá erro:
--
--   1) ACENTOS. "valvula" não encontrava "válvula". Em Angola escreve-se sem
--      acentos na caixa de pesquisa — é a norma, não a exceção. O fornecedor
--      que publicou bem não aparecia, e concluía (com razão) que a culpa era
--      da plataforma.
--   2) ESCALA. `%termo%` não usa índice nenhum; é varrimento de tabela em
--      todas as pesquisas. Com dez produtos não se nota. É exatamente o tipo
--      de coisa que só se nota quando já há catálogo a sério.
--
-- A RESOLUÇÃO é uma coluna normalizada, mantida por gatilho, mais um índice de
-- trigramas.
--
-- PORQUE NÃO `unaccent()`: parecia o caminho óbvio e tem duas arestas. Não é
-- IMMUTABLE (depende do dicionário), por isso não serve para coluna gerada sem
-- um embrulho que mente ao planeador; e no Supabase vive no schema
-- `extensions`, que pode não estar no search_path do papel que corre o gatilho
-- — falharia em produção e não aqui. `translate()` é do core, é determinista, e
-- o conjunto de acentos do português é pequeno e conhecido.
--
-- O MESMO mapa existe em JS (marketplaceService.normalizarParaPesquisa). Se os
-- dois se desencontrarem, a pesquisa deixa de encontrar — há um teste que os
-- compara caractere a caractere, precisamente por isso.

CREATE OR REPLACE FUNCTION kixima_normalizar(txt text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT translate(
    lower(coalesce(txt, '')),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'
  );
$$;

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "search_text" TEXT;

-- O gatilho, e não código da aplicação: uma importação de catálogo em massa,
-- uma correção feita por SQL ou uma migração futura não podem deixar linhas
-- fora do índice. Uma linha sem `search_text` não dá erro — desaparece da
-- pesquisa, que é a avaria mais difícil de ver.
CREATE OR REPLACE FUNCTION products_search_text()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."search_text" := kixima_normalizar(
    concat_ws(' ',
      NEW."name", NEW."description", NEW."category", NEW."specialty",
      NEW."brand", NEW."model", NEW."unspsc_title", NEW."city", NEW."keywords"
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_search_text_trg ON "products";
CREATE TRIGGER products_search_text_trg
  BEFORE INSERT OR UPDATE ON "products"
  FOR EACH ROW EXECUTE FUNCTION products_search_text();

-- Linhas que já existiam.
UPDATE "products" SET "search_text" = kixima_normalizar(
  concat_ws(' ', "name", "description", "category", "specialty",
                 "brand", "model", "unspsc_title", "city", "keywords")
) WHERE "search_text" IS NULL;

-- O índice de trigramas é o que torna `%termo%` barato. É a única parte que
-- depende de uma extensão, e por isso é a única que se deixa falhar em
-- silêncio: sem ela a pesquisa continua CERTA, apenas mais lenta. Trocar
-- "resultados errados" por "resultados lentos" é a troca que se quer; o
-- contrário nunca.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE INDEX IF NOT EXISTS "products_search_text_trgm_idx"
    ON "products" USING gin ("search_text" gin_trgm_ops);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pg_trgm indisponível (%): a pesquisa fica correta mas sem índice. Instale a extensão para recuperar o desempenho.', SQLERRM;
END;
$$;
