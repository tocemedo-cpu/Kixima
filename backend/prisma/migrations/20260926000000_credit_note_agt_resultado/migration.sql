-- Resultado do último reenvio explícito da Nota de Crédito à AGT
-- (registarFactura NC, ver creditNoteService.reenviarAgt) — mesmo mecanismo
-- de Invoice.agtRequestId/agtResultCode/agtErro/agtEstado.

-- AlterTable
ALTER TABLE "credit_notes" ADD COLUMN     "agt_erro" JSONB,
ADD COLUMN     "agt_estado" JSONB,
ADD COLUMN     "agt_request_id" TEXT,
ADD COLUMN     "agt_result_code" TEXT;
