-- Nota de crédito — mecanismo de correção fiscal (nunca um UPDATE na fatura
-- já emitida). Mesmo padrão de series_faturacao/invoices (20260901000000):
-- série e cadeia de hash próprias, restrição de unicidade na PRÓPRIA base de
-- dados, não só no código.

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NOTA_CREDITO_EMITIDA';

CREATE TABLE IF NOT EXISTS "credit_notes" (
  "id"               TEXT PRIMARY KEY,
  "reference"        TEXT NOT NULL,
  "invoice_id"       TEXT NOT NULL,
  "motivo"           TEXT NOT NULL,
  "amount"           DECIMAL(14,2) NOT NULL,
  "net_amount"       DECIMAL(14,2),
  "tax_amount"       DECIMAL(14,2),
  "currency"         TEXT NOT NULL DEFAULT 'AOA',
  "serie"            TEXT,
  "numero_na_serie"  INTEGER,
  "hash_documento"   TEXT,
  "hash_anterior"    TEXT,
  "assinada_em"      TIMESTAMP(3),
  "issued_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by_id"    TEXT,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "credit_notes_invoice_id_fkey" FOREIGN KEY ("invoice_id")
    REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "credit_notes_reference_key" ON "credit_notes"("reference");

CREATE INDEX IF NOT EXISTS "credit_notes_invoice_id_idx" ON "credit_notes"("invoice_id");

-- Duas notas de crédito com o mesmo número na mesma série é o erro que esta
-- restrição torna impossível — tal como já vale para as faturas.
CREATE UNIQUE INDEX IF NOT EXISTS "credit_notes_serie_numero_key"
  ON "credit_notes"("serie", "numero_na_serie")
  WHERE "serie" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "credit_notes_serie_numero_idx"
  ON "credit_notes"("serie", "numero_na_serie");
