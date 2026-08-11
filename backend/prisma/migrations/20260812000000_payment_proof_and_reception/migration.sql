-- AlterTable
-- IF NOT EXISTS: idempotente — tolera a aplicação manual prévia das colunas
-- (SQL Editor do Supabase) sem falhar com "duplicate column".
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "proof_name" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "proof_url" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "received_at" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "received_by_id" TEXT;
