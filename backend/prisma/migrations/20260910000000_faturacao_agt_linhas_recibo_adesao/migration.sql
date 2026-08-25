-- Conformação do modelo de fatura ao esquema de documento da AGT (DS.120 —
-- FE, e os modelos impressos de referência FACTURA/RECIBO do Portal do
-- Contribuinte), no que é modelo de dados e não depende de credenciais reais:
--
--   1) invoice_lines: a fatura passa a ter linhas com imposto decomposto
--      (IEC/IVA/Selo), como a FACTURA de referência exige — cópia das
--      PurchaseOrderItem no momento da emissão, nunca uma referência viva.
--   2) payments: ganha os mesmos cinco campos de certificação que
--      invoices/credit_notes já têm — o pagamento É o documento "RC" (Recibo)
--      da AGT, com série e cadeia de integridade próprias.
--   3) companies: data de adesão à faturação eletrónica, nula até a empresa
--      aderir — mesma semântica inerte-até-configurado que serie_fiscal já
--      usa.

CREATE TABLE IF NOT EXISTS "invoice_lines" (
  "id"           TEXT PRIMARY KEY,
  "invoice_id"   TEXT NOT NULL,
  "line_number"  INTEGER NOT NULL,
  "product_code" TEXT NOT NULL,
  "description"  TEXT NOT NULL,
  "quantity"     DECIMAL(14,3) NOT NULL,
  "unit_price"   DECIMAL(14,2) NOT NULL,
  "discount"     DECIMAL(14,2) NOT NULL DEFAULT 0,
  "net_amount"   DECIMAL(14,2) NOT NULL,
  "iva_amount"   DECIMAL(14,2) NOT NULL DEFAULT 0,
  "iec_amount"   DECIMAL(14,2) NOT NULL DEFAULT 0,
  "is_amount"    DECIMAL(14,2) NOT NULL DEFAULT 0,
  "iva_tax_code" TEXT NOT NULL DEFAULT 'NOR',
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id")
    REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "invoice_lines_invoice_id_line_number_key"
  ON "invoice_lines"("invoice_id", "line_number");

ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "serie" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "numero_na_serie" INTEGER;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "hash_documento" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "hash_anterior" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "assinada_em" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "payments_serie_numero_na_serie_idx"
  ON "payments"("serie", "numero_na_serie");

ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "data_adesao_facturacao_electronica" TIMESTAMP(3);
