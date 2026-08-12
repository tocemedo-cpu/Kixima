-- Modelo comercial: planos (BÁSICO/PRO), dimensão da empresa (MPME), Taxa
-- KIXIMA em USD com limiar, e o programa Supplier Development.
-- Idempotente (IF NOT EXISTS) — tolera aplicação manual prévia.

-- Enums -----------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "CompanySize" AS ENUM ('MICRO', 'PEQUENA', 'MEDIA', 'GRANDE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "CompanyPlan" AS ENUM ('BASICO', 'PRO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SupplierDevTrack" AS ENUM ('BUROCRACIA', 'PARCERIA', 'AMBOS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SupplierDevStatus" AS ENUM ('RECEBIDA', 'EM_ANALISE', 'EM_ACOMPANHAMENTO', 'CONCLUIDA', 'REJEITADA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Novo tipo de notificação. O nome do enum na base depende de como ela foi
-- criada: as migrações do Prisma criam "NotificationType"; o prisma/supabase_setup.sql
-- (usado por quem manteve o Supabase à mão) cria notification_type. Resolve-se o
-- nome real em vez de o assumir — caso contrário a migração rebenta com
-- "type does not exist" numa base que veio do segundo caminho.
DO $$
DECLARE tipo text;
BEGIN
  SELECT t.typname INTO tipo
    FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
   WHERE t.typname IN ('NotificationType', 'notification_type')
     AND n.nspname = current_schema()
   ORDER BY (t.typname = 'NotificationType') DESC
   LIMIT 1;
  IF tipo IS NOT NULL THEN
    EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', tipo, 'SUPPLIER_DEV_RECEBIDA');
  END IF;
END $$;

-- Empresa: dimensão e plano ----------------------------------------------------
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "employees" INTEGER;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "annual_revenue_usd" DECIMAL(16,2);
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "size" "CompanySize" NOT NULL DEFAULT 'PEQUENA';
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "plan" "CompanyPlan" NOT NULL DEFAULT 'BASICO';
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "seat_price_usd" DECIMAL(10,2) NOT NULL DEFAULT 100;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "plan_notes" TEXT;

-- Taxa da plataforma: passa a USD, com base de cálculo e câmbio auditáveis ------
ALTER TABLE "platform_fees" ADD COLUMN IF NOT EXISTS "basis" TEXT;
ALTER TABLE "platform_fees" ADD COLUMN IF NOT EXISTS "po_value_usd" DECIMAL(16,2);
ALTER TABLE "platform_fees" ADD COLUMN IF NOT EXISTS "fx_rate" DECIMAL(14,4);
ALTER TABLE "platform_fees" ALTER COLUMN "currency" SET DEFAULT 'USD';

-- Supplier Development ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS "supplier_dev_requests" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "company_id" TEXT,
    "company_name" TEXT NOT NULL,
    "tax_id" TEXT,
    "contact_name" TEXT NOT NULL,
    "contact_email" TEXT NOT NULL,
    "contact_phone" TEXT,
    "province" TEXT,
    "sector" TEXT,
    "employees" INTEGER,
    "track" "SupplierDevTrack" NOT NULL DEFAULT 'AMBOS',
    "needs" TEXT,
    "status" "SupplierDevStatus" NOT NULL DEFAULT 'RECEBIDA',
    "admin_notes" TEXT,
    "handled_by_id" TEXT,
    "handled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supplier_dev_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "supplier_dev_requests_reference_key" ON "supplier_dev_requests"("reference");
CREATE INDEX IF NOT EXISTS "supplier_dev_requests_status_idx" ON "supplier_dev_requests"("status");

DO $$ BEGIN
  ALTER TABLE "supplier_dev_requests"
    ADD CONSTRAINT "supplier_dev_requests_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Taxa de acesso ao programa Supplier Development (100 USD para pequenas
-- empresas; restantes casos orçamentados).
ALTER TABLE "supplier_dev_requests" ADD COLUMN IF NOT EXISTS "access_fee_usd" DECIMAL(10,2);
ALTER TABLE "supplier_dev_requests" ADD COLUMN IF NOT EXISTS "custom_pricing" BOOLEAN NOT NULL DEFAULT false;
