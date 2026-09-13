-- Corrige a auditoria N1: a query de call-offs "pendentes de faturar" em
-- contractService.consolidateContractBilling filtrava por `invoice: null`
-- (relação inversa de Invoice.purchaseOrderId), mas esse campo fica SEMPRE
-- null numa fatura consolidada (é estrutural: uma fatura consolidada cobre
-- várias PO, não pode usar a FK 1:1 normal) — por isso a mesma call-off
-- nunca deixava de aparecer como "pendente", mesmo depois de já ter sido
-- faturada. Este campo próprio marca isso de forma explícita.
--
-- Idempotente: pode ser corrido mais do que uma vez sem erro.

ALTER TABLE "purchase_orders"
  ADD COLUMN IF NOT EXISTS "consolidated_invoice_id" TEXT;

CREATE INDEX IF NOT EXISTS "purchase_orders_consolidated_invoice_id_idx"
  ON "purchase_orders"("consolidated_invoice_id");

DO $$ BEGIN
  ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_consolidated_invoice_id_fkey"
    FOREIGN KEY ("consolidated_invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
