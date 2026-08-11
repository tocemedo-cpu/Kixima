-- AlterTable
-- IF NOT EXISTS: idempotente — tolera aplicação manual prévia (SQL Editor).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_secret" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_enabled_at" TIMESTAMP(3);
