-- Supplier Development / Parceiros internacionais: a TAXA DE ACESSO passa a ser
-- COBRADA LOGO NA SUBMISSÃO DA INTENÇÃO, igual para qualquer candidato (é a
-- taxa de acesso das pequenas empresas). O RESTANTE do programa continua a ser
-- orçamentado caso a caso, agora numa coluna própria.
--
-- Idempotente: pode ser corrido mais do que uma vez sem erro.

-- Estado da cobrança da taxa de acesso (reutiliza o enum das taxas da
-- plataforma: PENDENTE → COBRADO).
ALTER TABLE "supplier_dev_requests"
  ADD COLUMN IF NOT EXISTS "fee_status" "PlatformFeeStatus" NOT NULL DEFAULT 'PENDENTE';

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
