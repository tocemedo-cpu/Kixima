-- CreateEnum
CREATE TYPE "CanalCobranca" AS ENUM ('TRANSFERENCIA_MANUAL', 'EMIS_MULTICAIXA', 'PAYPAY', 'BAI', 'BFA', 'STANDARD_BANK_ANGOLA');

-- AlterTable
-- Aditiva e segura para linhas existentes: "canal" tem valor por omissão
-- igual ao que já era verdade para toda a cobrança já criada (só havia
-- transferência manual até agora), e as outras duas colunas são opcionais.
ALTER TABLE "plano_cobrancas" ADD COLUMN     "canal" "CanalCobranca" NOT NULL DEFAULT 'TRANSFERENCIA_MANUAL',
ADD COLUMN     "referencia_externa" TEXT,
ADD COLUMN     "telemovel" TEXT;

-- CreateIndex
CREATE INDEX "plano_cobrancas_canal_referencia_externa_idx" ON "plano_cobrancas"("canal", "referencia_externa");
