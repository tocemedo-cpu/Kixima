-- Chaves de API do catálogo (plano Pro).
--
-- Uma chave de API contorna o login E a verificação em dois passos — um sistema
-- não introduz um código de 6 dígitos. Por isso guarda-se o HASH e não a chave:
-- quem consiga ler esta tabela não fica com acesso ao catálogo de ninguém.
--
-- O `prefixo` é a parte visível (kxm_a1b2…), suficiente para a pessoa reconhecer
-- qual chave revogar sem que a chave inteira exista em lado nenhum depois de
-- mostrada uma vez.
CREATE TABLE IF NOT EXISTS "api_keys" (
  "id"          TEXT NOT NULL,
  "company_id"  TEXT NOT NULL,
  "nome"        TEXT NOT NULL,
  "prefixo"     TEXT NOT NULL,
  "hash"        TEXT NOT NULL,
  "criada_por"  TEXT,
  "ultimo_uso"  TIMESTAMP(3),
  "revogada_em" TIMESTAMP(3),
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_prefixo_key" ON "api_keys"("prefixo");
CREATE INDEX IF NOT EXISTS "api_keys_company_id_idx" ON "api_keys"("company_id");

DO $$ BEGIN
  ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
