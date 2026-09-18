-- Resultado da submissão explícita e visível de uma nota de crédito à AGT
-- (registarFactura), feita ao anular uma fatura por completo — ver
-- creditNoteService.anular()/agtPayloadService.submeterNotaCredito(). Mesmo
-- padrão de invoices.agt_request_id/agt_result_code/agt_erro/agt_estado
-- (migração 20260923000000_invoice_agt_resultado / 20260925000000_invoice_agt_estado).
ALTER TABLE "credit_notes" ADD COLUMN     "agt_request_id" TEXT,
ADD COLUMN     "agt_result_code" TEXT,
ADD COLUMN     "agt_erro" JSONB,
ADD COLUMN     "agt_estado" JSONB;
