-- IVA na ORDEM DE COMPRA.
--
-- Até aqui o IVA só era calculado na fatura: a PO guardava o valor líquido e a
-- fatura o valor com imposto. O comprador via na ordem um total menor do que
-- aquele que ia pagar, e o limite de orçamento era consumido a menos.
--
-- A partir de agora total_amount é o valor COM IVA (igual ao da fatura que a PO
-- gera) e o líquido/imposto ficam discriminados.
--
-- Idempotente: pode ser corrido mais do que uma vez sem erro.

ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "net_amount" DECIMAL(14,2);
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "tax_amount" DECIMAL(14,2);
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "withholding_amount" DECIMAL(14,2);

-- As ordens ANTERIORES foram criadas sem IVA: o total delas é o líquido. Não se
-- reescreve o histórico — regista-se o que na verdade aconteceu (imposto zero),
-- para os documentos já emitidos continuarem a bater certo.
UPDATE "purchase_orders"
   SET "net_amount" = COALESCE("net_amount", "total_amount"),
       "tax_amount" = COALESCE("tax_amount", 0),
       "withholding_amount" = COALESCE("withholding_amount", 0)
 WHERE "net_amount" IS NULL;
