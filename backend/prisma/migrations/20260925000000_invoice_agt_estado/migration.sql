-- Estado real do processamento (obterEstado, DS.120) — consultado
-- automaticamente assim que registarFactura devolve requestID, aceite ou
-- recusado (ver agtPayloadService.submeterFatura).

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "agt_estado" JSONB;
