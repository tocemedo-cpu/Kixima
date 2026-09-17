-- Resultado do último reenvio do FT à AGT (registarFactura, ao pagamento) —
-- ver paymentService.processPayment e agtInvoiceResubmission. Sem isto, esse
-- resultado só existia na resposta HTTP do momento do pagamento.

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "agt_erro" JSONB,
ADD COLUMN     "agt_request_id" TEXT,
ADD COLUMN     "agt_result_code" TEXT;
