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

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SUPPLIER_DEV_RECEBIDA';

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
