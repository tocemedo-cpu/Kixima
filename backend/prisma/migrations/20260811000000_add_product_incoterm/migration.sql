-- AlterTable
-- IF NOT EXISTS: idempotente — permite aplicar a coluna manualmente (SQL Editor
-- do Supabase) em emergência sem que o `migrate deploy` posterior falhe com
-- "duplicate column".
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "incoterm" TEXT;
