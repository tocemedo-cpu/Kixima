-- AlterTable
-- IF NOT EXISTS: idempotente — tolera aplicação manual prévia (SQL Editor).
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "divergence_resolution" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "divergence_resolution_notes" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "divergence_resolved_at" TIMESTAMP(3);

-- AlterEnum: novo tipo de notificação para o desfecho da divergência.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DIVERGENCIA_RESOLVIDA';
