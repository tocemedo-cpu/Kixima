-- Fluxo completo da PO: recusa do fornecedor com motivo obrigatório, e
-- cobertura de notificações que faltava (entrega marcada, receção conforme,
-- conclusão da ordem). Idempotente — tolera aplicação manual prévia.

-- AlterTable: motivo da recusa do fornecedor (distinto de rejectionReason,
-- que é da rejeição pelo Company Admin na aprovação).
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "refused_at" TIMESTAMP(3);
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "refusal_reason" TEXT;

-- AlterEnum: quatro tipos de notificação novos.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PO_RECUSADA_FORNECEDOR';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PO_ENTREGUE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PO_RECEBIDA_CONFORME';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PO_CONCLUIDA';
