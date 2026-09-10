-- ERP DOA Approval (PRO): a PO nasce erpManaged quando o comprador tem ERP
-- real configurado e o plano inclui erpIntegration — a aprovação e o
-- pagamento passam a acontecer no ERP, não no KIXIMA. ErpSyncLog regista o
-- histórico de sincronização (nunca o payload bruto completo).
--
-- Idempotente: pode ser corrido mais do que uma vez sem erro.

ALTER TABLE "purchase_orders"
  ADD COLUMN IF NOT EXISTS "erp_managed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "erp_external_id" TEXT,
  ADD COLUMN IF NOT EXISTS "erp_approval_requested_at" TIMESTAMP(3);

DO $$ BEGIN
  CREATE TYPE "ErpSyncDirection" AS ENUM ('OUTBOUND', 'INBOUND');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ErpSyncStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "erp_sync_logs" (
  "id"                TEXT NOT NULL,
  "purchase_order_id" TEXT NOT NULL,
  "direction"         "ErpSyncDirection" NOT NULL,
  "event_type"        TEXT NOT NULL,
  "status"            "ErpSyncStatus" NOT NULL,
  "external_id"       TEXT,
  "error_message"     TEXT,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "erp_sync_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "erp_sync_logs_purchase_order_id_idx" ON "erp_sync_logs"("purchase_order_id");

DO $$ BEGIN
  ALTER TABLE "erp_sync_logs" ADD CONSTRAINT "erp_sync_logs_purchase_order_id_fkey"
    FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Pagamento confirmado pelo ERP do comprador — o dinheiro não passa pelo
-- KIXIMA, só a confirmação (ver poService.aplicarPagamentoErp).
ALTER TYPE "CanalPagamento" ADD VALUE IF NOT EXISTS 'ERP';
