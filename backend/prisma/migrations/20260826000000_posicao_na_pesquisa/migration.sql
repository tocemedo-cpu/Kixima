-- Posição na pesquisa, derivada do plano.
--
-- É a alavanca que substitui o limite de itens: o plano de entrada publica tudo
-- — o catálogo nunca é limitado — mas ordena abaixo dos pagos na relevância.
--
-- Porquê uma coluna e não ordenar pelo enum: no Postgres a ordenação de um enum
-- segue a ordem de DECLARAÇÃO do tipo, não a ordem comercial. Com ENTRADA, CORE,
-- PRO, BASICO declarados por essa ordem, um `ORDER BY plan DESC` poria o BASICO
-- em primeiro. E acrescentar um valor ao enum mudaria a ordenação do
-- marketplace sem ninguém dar por isso.
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "search_rank" INTEGER NOT NULL DEFAULT 0;

UPDATE "companies" SET "search_rank" = CASE "plan"
  WHEN 'PRO'    THEN 2
  WHEN 'CORE'   THEN 1
  WHEN 'BASICO' THEN 1   -- sinónimo de CORE
  ELSE 0
END;

-- A ordenação por relevância passa por aqui em todas as pesquisas do catálogo.
CREATE INDEX IF NOT EXISTS "companies_search_rank_idx" ON "companies"("search_rank");
