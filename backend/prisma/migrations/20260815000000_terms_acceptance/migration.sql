-- AlterTable
-- IF NOT EXISTS: idempotente — tolera aplicação manual prévia (SQL Editor).
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "terms_accepted_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "terms_accepted_at" TIMESTAMP(3);
