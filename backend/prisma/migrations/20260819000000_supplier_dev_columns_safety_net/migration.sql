-- Rede de segurança para as colunas do Supplier Development.
--
-- Porquê: a migração 20260817 foi editada DEPOIS de já ter sido aplicada em
-- produção (as duas últimas colunas foram-lhe acrescentadas mais tarde). O
-- `migrate deploy` não reavalia migrações já registadas — vê-a como aplicada e
-- salta-a — por isso essas colunas nunca chegaram a existir nessa base, e tudo
-- o que veio a seguir falhava com «column does not exist».
--
-- Esta migração não acrescenta funcionalidade nenhuma: apenas garante que todas
-- as colunas da tabela existem, seja qual for o ponto do histórico em que cada
-- base ficou. Numa base saudável é inteiramente um no-op.
--
-- LIÇÃO: nunca editar uma migração já aplicada. Se for preciso mudar alguma
-- coisa, cria-se uma migração nova como esta.

ALTER TABLE "supplier_dev_requests" ADD COLUMN IF NOT EXISTS "access_fee_usd" DECIMAL(10,2);
ALTER TABLE "supplier_dev_requests" ADD COLUMN IF NOT EXISTS "custom_pricing" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "supplier_dev_requests" ADD COLUMN IF NOT EXISTS "fee_paid_at" TIMESTAMP(3);
ALTER TABLE "supplier_dev_requests" ADD COLUMN IF NOT EXISTS "program_fee_usd" DECIMAL(12,2);

-- fee_status usa o enum das taxas da plataforma, cujo nome depende de como a
-- base foi criada. Resolve-se o nome real e cria-se o tipo se não existir.
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

-- O restante do programa fica por orçamentar até a KIXIMA fazer a proposta.
ALTER TABLE "supplier_dev_requests" ALTER COLUMN "custom_pricing" SET DEFAULT true;

-- Candidaturas anteriores a esta alteração: taxa de entrada de tabela.
UPDATE "supplier_dev_requests"
   SET "access_fee_usd" = COALESCE("access_fee_usd", 100)
 WHERE "access_fee_usd" IS NULL;
