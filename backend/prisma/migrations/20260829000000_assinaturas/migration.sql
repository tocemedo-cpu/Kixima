-- Cobranças de subscrição.
--
-- Não há gateway de pagamento, e isso não é uma lacuna: em Angola o B2B paga-se
-- por transferência. A plataforma já cobra as faturas assim (comprovativo
-- carregado, confirmado por quem recebe) e a subscrição segue o mesmo caminho.
--
-- O preço fica GRAVADO na cobrança: se a tabela de preços mudar amanhã, uma
-- cobrança emitida hoje continua a valer o que foi acordado.
DO $$ BEGIN
  CREATE TYPE "CobrancaStatus" AS ENUM ('PENDENTE', 'COMPROVATIVO_ENVIADO', 'CONFIRMADA', 'CANCELADA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "plano_cobrancas" (
  "id"               TEXT NOT NULL,
  "referencia"       TEXT NOT NULL,
  "company_id"       TEXT NOT NULL,
  "plano_atual"      "CompanyPlan" NOT NULL,
  "plano_novo"       "CompanyPlan" NOT NULL,
  "valor_usd"        DECIMAL(12,2) NOT NULL,
  "periodo"          TEXT NOT NULL,
  "meses"            INTEGER NOT NULL,
  "status"           "CobrancaStatus" NOT NULL DEFAULT 'PENDENTE',
  "comprovativo_url" TEXT,
  "submetido_em"     TIMESTAMP(3),
  "confirmada_por"   TEXT,
  "confirmada_em"    TIMESTAMP(3),
  "valido_ate"       TIMESTAMP(3),
  "notas"            TEXT,
  "created_by_id"    TEXT,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "plano_cobrancas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "plano_cobrancas_referencia_key" ON "plano_cobrancas"("referencia");
CREATE INDEX IF NOT EXISTS "plano_cobrancas_company_id_idx" ON "plano_cobrancas"("company_id");
CREATE INDEX IF NOT EXISTS "plano_cobrancas_status_idx" ON "plano_cobrancas"("status");

DO $$ BEGIN
  ALTER TABLE "plano_cobrancas" ADD CONSTRAINT "plano_cobrancas_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Até quando a subscrição está paga. Null = nunca foi cobrada.
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "plano_valido_ate" TIMESTAMP(3);
