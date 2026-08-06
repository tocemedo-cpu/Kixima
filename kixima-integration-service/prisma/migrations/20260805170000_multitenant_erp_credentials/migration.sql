-- IntegrationEvent: tenant dono da transação
ALTER TABLE "integration_events" ADD COLUMN "tenant_id" TEXT;

-- ErpCredential passa a ser POR TENANT
ALTER TABLE "erp_credentials" ADD COLUMN "tenant_id" TEXT NOT NULL DEFAULT '*';
ALTER TABLE "erp_credentials" ALTER COLUMN "tenant_id" DROP DEFAULT;

-- remover o unique antigo em (erp) e criar unique (tenant_id, erp) + índice
DROP INDEX IF EXISTS "erp_credentials_erp_key";
CREATE UNIQUE INDEX "erp_credentials_tenant_id_erp_key" ON "erp_credentials"("tenant_id", "erp");
CREATE INDEX "erp_credentials_tenant_id_idx" ON "erp_credentials"("tenant_id");
