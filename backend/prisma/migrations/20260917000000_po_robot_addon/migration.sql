-- Automatic PO Robot (add-on PRO, pago): CompanyAddon + AddonCobranca
-- (espelha plano_cobrancas campo a campo) + PoRoboRegra. O robot PREPARA a
-- PO mas nunca a aprova nem paga — createdBySource distingue-a na auditoria,
-- não muda em nada o fluxo de aprovação/pagamento existente.

DO $$ BEGIN
  CREATE TYPE "CompanyAddonStatus" AS ENUM ('INATIVO', 'ATIVO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "company_addons" (
  "id"           TEXT NOT NULL,
  "company_id"   TEXT NOT NULL,
  "addon_key"    TEXT NOT NULL,
  "status"       "CompanyAddonStatus" NOT NULL DEFAULT 'INATIVO',
  "activated_at" TIMESTAMP(3),
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "company_addons_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "company_addons_company_id_addon_key_key" ON "company_addons"("company_id", "addon_key");

DO $$ BEGIN
  ALTER TABLE "company_addons" ADD CONSTRAINT "company_addons_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "addon_cobrancas" (
  "id"                 TEXT NOT NULL,
  "referencia"         TEXT NOT NULL,
  "company_id"         TEXT NOT NULL,
  "addon_key"          TEXT NOT NULL,
  "valor_usd"          DECIMAL(12,2) NOT NULL,
  "periodo"            TEXT NOT NULL,
  "meses"              INTEGER NOT NULL,
  "status"             "CobrancaStatus" NOT NULL DEFAULT 'PENDENTE',
  "comprovativo_url"   TEXT,
  "submetido_em"       TIMESTAMP(3),
  "confirmada_por"     TEXT,
  "confirmada_em"      TIMESTAMP(3),
  "valido_ate"         TIMESTAMP(3),
  "notas"              TEXT,
  "canal"              "CanalCobranca" NOT NULL DEFAULT 'TRANSFERENCIA_MANUAL',
  "referencia_externa" TEXT,
  "telemovel"          TEXT,
  "created_by_id"      TEXT,
  "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "addon_cobrancas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "addon_cobrancas_referencia_key" ON "addon_cobrancas"("referencia");
CREATE INDEX IF NOT EXISTS "addon_cobrancas_company_id_idx" ON "addon_cobrancas"("company_id");
CREATE INDEX IF NOT EXISTS "addon_cobrancas_status_idx" ON "addon_cobrancas"("status");
CREATE INDEX IF NOT EXISTS "addon_cobrancas_canal_referencia_externa_idx" ON "addon_cobrancas"("canal", "referencia_externa");

DO $$ BEGIN
  ALTER TABLE "addon_cobrancas" ADD CONSTRAINT "addon_cobrancas_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PoRoboMediaOrigem" AS ENUM ('IA', 'MANUAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PoRoboPeriodicidade" AS ENUM ('SEMANAL', 'QUINZENAL', 'MENSAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "po_robo_regras" (
  "id"                  TEXT NOT NULL,
  "company_id"          TEXT NOT NULL,
  "product_id"          TEXT NOT NULL,
  "media_origem"        "PoRoboMediaOrigem" NOT NULL DEFAULT 'IA',
  "media_mensal"        DECIMAL(14,3) NOT NULL,
  "periodicidade"       "PoRoboPeriodicidade" NOT NULL DEFAULT 'MENSAL',
  "quantidade"          INTEGER,
  "ativo"               BOOLEAN NOT NULL DEFAULT true,
  "limite_maximo_usd"   DECIMAL(14,2),
  "proxima_execucao_em" TIMESTAMP(3) NOT NULL,
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "po_robo_regras_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "po_robo_regras_company_id_idx" ON "po_robo_regras"("company_id");
CREATE INDEX IF NOT EXISTS "po_robo_regras_ativo_proxima_execucao_em_idx" ON "po_robo_regras"("ativo", "proxima_execucao_em");

DO $$ BEGIN
  ALTER TABLE "po_robo_regras" ADD CONSTRAINT "po_robo_regras_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "po_robo_regras" ADD CONSTRAINT "po_robo_regras_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "purchase_orders"
  ADD COLUMN IF NOT EXISTS "created_by_source" TEXT NOT NULL DEFAULT 'HUMANO';
