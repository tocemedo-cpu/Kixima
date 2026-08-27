-- CreateEnum
CREATE TYPE "FeedbackCategoria" AS ENUM ('FORNECEDOR', 'PRODUTO', 'SERVICO', 'PEDIDO', 'ENTREGA', 'PAGAMENTO', 'ATENDIMENTO', 'EXPERIENCIA_GERAL');

-- As avaliações antigas eram anónimas (nome/empresa escritos à mão, sem
-- conta ligada) — não há nenhuma User/Company real a que atribuí-las sob o
-- novo esquema, que exige sempre um autor autenticado. Não há migração de
-- dados possível aqui: se quiser preservar um registo do que existia,
-- exporte a tabela "feedback" ANTES de aplicar esta migração (ex.:
-- `\copy (select * from feedback) to 'feedback_backup.csv' csv header`).
DELETE FROM "feedback";

-- AlterTable
ALTER TABLE "feedback" DROP COLUMN "company",
DROP COLUMN "name",
DROP COLUMN "role",
ADD COLUMN     "categoria" "FeedbackCategoria" NOT NULL,
ADD COLUMN     "company_id" TEXT NOT NULL,
ADD COLUMN     "target_id" TEXT,
ADD COLUMN     "target_label" TEXT,
ADD COLUMN     "user_id" TEXT NOT NULL,
ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "feedback_user_id_idx" ON "feedback"("user_id");

-- CreateIndex
CREATE INDEX "feedback_company_id_idx" ON "feedback"("company_id");

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
