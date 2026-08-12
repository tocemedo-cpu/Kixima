-- AlterTable
-- IF NOT EXISTS: idempotente — tolera aplicação manual prévia (SQL Editor).
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "divergence_resolution" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "divergence_resolution_notes" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "divergence_resolved_at" TIMESTAMP(3);

-- AlterEnum: novo tipo de notificação para o desfecho da divergência.
-- O nome do enum na base depende de como ela foi criada: as migrações do Prisma
-- criam "NotificationType"; o prisma/supabase_setup.sql cria notification_type.
-- Resolve-se o nome real em vez de o assumir — assumi-lo faz a migração rebentar
-- com «type "NotificationType" does not exist» numa base vinda do segundo caminho.
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
    EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', tipo, 'DIVERGENCIA_RESOLVIDA');
  END IF;
END $$;
