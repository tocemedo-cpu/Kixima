-- documentNo REAL da AGT, atribuído atomicamente pela série que a AGT
-- concedeu (AgtSeriesFe), independente da série fiscal interna
-- (Invoice/CreditNote/Payment.serie) — ver agtSeriesService.atribuirDocumentNo.

-- AlterTable
ALTER TABLE "agtseriesfe" ADD COLUMN     "ultimo_numero" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "credit_notes" ADD COLUMN     "agt_document_no" TEXT;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "agt_document_no" TEXT;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "agt_document_no" TEXT;
