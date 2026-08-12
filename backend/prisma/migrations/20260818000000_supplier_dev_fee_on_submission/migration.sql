-- Supplier Development / Parceiros internacionais: a TAXA DE ACESSO passa a ser
-- COBRADA LOGO NA SUBMISSÃO DA INTENÇÃO, igual para qualquer candidato (é a
-- taxa de acesso das pequenas empresas). O RESTANTE do programa continua a ser
-- orçamentado caso a caso, agora numa coluna própria.
--
-- Idempotente: pode ser corrido mais do que uma vez sem erro.

-- Estado da cobrança da taxa de acesso (reutiliza o enum das taxas da
-- plataforma: PENDENTE → COBRADO). O nome do enum depende de como a base foi
-- criada — "PlatformFeeStatus" pelas migrações do Prisma, platform_fee_status
-- pelo prisma/supabase_setup.sql — por isso resolve-se o nome real, e cria-se o
-- tipo se nenhum dos dois existir.
DO $$
DECLARE tipo text;
BEGIN
  SELECT t.typname INTO tipo
    FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
   WHERE t.typname IN ('PlatformFeeStatus', 'platform_fee_status')
     AND n.nspname = current_schema()
   ORDER BY (t.typname = 'PlatformFeeStatus') DESC
   LIMIT 1;

  IF tipo IS NULL THEN
    CREATE TYPE "PlatformFeeStatus" AS ENUM ('PENDENTE', 'COBRADO');
    tipo := 'PlatformFeeStatus';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = 'supplier_dev_requests'
       AND column_name = 'fee_status'
  ) THEN
    EXECUTE format(
      'ALTER TABLE "supplier_dev_requests" ADD COLUMN "fee_status" %I NOT NULL DEFAULT %L',
      tipo, 'PENDENTE'
    );
  END IF;
END $$;

ALTER TABLE "supplier_dev_requests"
  ADD COLUMN IF NOT EXISTS "fee_paid_at" TIMESTAMP(3);

-- Orçamento do restante do programa, definido pela KIXIMA após a triagem.
ALTER TABLE "supplier_dev_requests"
  ADD COLUMN IF NOT EXISTS "program_fee_usd" DECIMAL(12,2);

-- custom_pricing passa a significar "o restante do programa ainda está por
-- orçamentar" — verdadeiro por omissão em todas as candidaturas novas.
ALTER TABLE "supplier_dev_requests"
  ALTER COLUMN "custom_pricing" SET DEFAULT true;

-- Candidaturas já recebidas antes desta alteração: a taxa de entrada é a de
-- tabela e o restante fica por orçamentar.
UPDATE "supplier_dev_requests"
   SET "access_fee_usd" = COALESCE("access_fee_usd", 100),
       "custom_pricing" = true
 WHERE "program_fee_usd" IS NULL;
