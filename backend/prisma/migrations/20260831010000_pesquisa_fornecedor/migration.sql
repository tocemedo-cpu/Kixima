-- O nome do fornecedor também entra na pesquisa, e tem de seguir a mesma regra.
--
-- Migração separada e não a anterior editada: uma migração já aplicada não se
-- toca (scripts/migration-lock.js e tests/migrations.test.js impedem-no, e com
-- razão — a que já correu em produção nunca mais volta a correr).
--
-- Sem isto ficava uma inconsistência das piores: procurar "valvula" encontrava
-- "Válvula" no produto, mas procurar "petroangola" não encontrava
-- "Petroângola" no fornecedor. Metade da pesquisa tolerante e a outra metade
-- não é pior do que nenhuma das duas — quem usa não consegue construir um
-- modelo mental do que funciona.

ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "search_text" TEXT;

CREATE OR REPLACE FUNCTION companies_search_text()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."search_text" := kixima_normalizar(
    concat_ws(' ', NEW."name", NEW."city", NEW."country")
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS companies_search_text_trg ON "companies";
CREATE TRIGGER companies_search_text_trg
  BEFORE INSERT OR UPDATE ON "companies"
  FOR EACH ROW EXECUTE FUNCTION companies_search_text();

UPDATE "companies"
   SET "search_text" = kixima_normalizar(concat_ws(' ', "name", "city", "country"))
 WHERE "search_text" IS NULL;

DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS "companies_search_text_trgm_idx"
    ON "companies" USING gin ("search_text" gin_trgm_ops);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pg_trgm indisponível (%): pesquisa de fornecedores correta mas sem índice.', SQLERRM;
END;
$$;
