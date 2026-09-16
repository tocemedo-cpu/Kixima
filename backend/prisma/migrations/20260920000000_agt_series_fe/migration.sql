-- CreateTable
CREATE TABLE "agtseriesfe" (
    "id" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "tipo_documento" TEXT NOT NULL,
    "establishment_number" TEXT NOT NULL,
    "tax_registration_number" TEXT NOT NULL,
    "series_code" TEXT,
    "submission_uuid" TEXT NOT NULL,
    "request_id" TEXT,
    "result_code" TEXT NOT NULL,
    "solicitado_por_id" TEXT,
    "solicitado_por_nome" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agtseriesfe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agtseriesfe_ano_tipo_documento_idx" ON "agtseriesfe"("ano", "tipo_documento");
