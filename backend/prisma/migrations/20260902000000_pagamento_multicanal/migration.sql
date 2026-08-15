-- Pagamento por mais do que um canal, com referência bancária e conciliação.
--
-- O QUE MUDA E PORQUÊ. Hoje o pagamento é 100% manual: alguém do Financeiro
-- carrega um comprovativo em PDF e outra pessoa olha para ele. Funciona, e é o
-- que faz sentido no B2B angolano — mas o produto chama-se PAGAMENTO GARANTIDO,
-- e neste momento a garantia é uma pessoa a abrir um ficheiro. Isso não parte:
-- deixa de escalar, e o momento em que deixa é o momento em que há volume, que
-- é o pior momento para descobrir.
--
-- A referência bancária é o caminho mais curto até uma confirmação sem toque
-- humano: cada fatura ganha uma referência única, o banco devolve o extrato, e
-- as linhas casam sozinhas. Não depende de contrato com gateway nenhum.

-- Canais de pagamento. TRANSFERENCIA_MANUAL é o que existe hoje e continua a
-- existir: um canal automático que falhe não pode deixar ninguém sem forma de
-- pagar.
DO $$
BEGIN
  CREATE TYPE "CanalPagamento" AS ENUM ('TRANSFERENCIA_MANUAL', 'REFERENCIA_BANCARIA', 'MULTICAIXA_EXPRESS');
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;

ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "canal" "CanalPagamento" NOT NULL DEFAULT 'TRANSFERENCIA_MANUAL';

-- A referência que o pagador escreve na transferência. Única em toda a
-- plataforma: é a chave por onde a conciliação encontra a fatura, e duas
-- faturas com a mesma referência tornariam a conciliação ambígua — que é o
-- mesmo que inútil.
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "referencia_pagamento" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_referencia_pagamento_key"
  ON "invoices"("referencia_pagamento") WHERE "referencia_pagamento" IS NOT NULL;

-- Linhas do extrato bancário, tal como entraram.
--
-- GUARDA-SE O EXTRATO E NÃO SÓ O RESULTADO. Uma conciliação que só regista os
-- sucessos não permite responder à pergunta que interessa quando algo corre
-- mal: "o dinheiro entrou?" — e a resposta "não encontrámos nada" é diferente
-- de "entrou mas não casou". A segunda tem uma linha aqui; a primeira não.
CREATE TABLE IF NOT EXISTS "linhas_extrato" (
  "id"             TEXT PRIMARY KEY,
  -- Identificador da linha no banco. É o que torna a importação idempotente:
  -- importar o mesmo extrato duas vezes não pode pagar a mesma fatura duas
  -- vezes, e um extrato reenviado é uma ocorrência banal, não excecional.
  "id_no_banco"    TEXT NOT NULL,
  "data_valor"     TIMESTAMP(3) NOT NULL,
  "montante"       DECIMAL(14,2) NOT NULL,
  "moeda"          TEXT NOT NULL DEFAULT 'AOA',
  "descricao"      TEXT,
  -- A referência extraída da descrição, quando se consegue.
  "referencia"     TEXT,
  -- POR_CONCILIAR | CONCILIADA | SEM_CORRESPONDENCIA | DIVERGENTE
  "estado"         TEXT NOT NULL DEFAULT 'POR_CONCILIAR',
  "invoice_id"     TEXT REFERENCES "invoices"("id"),
  "motivo"         TEXT,
  "importada_em"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "conciliada_em"  TIMESTAMP(3)
);

CREATE UNIQUE INDEX IF NOT EXISTS "linhas_extrato_id_no_banco_key" ON "linhas_extrato"("id_no_banco");
CREATE INDEX IF NOT EXISTS "linhas_extrato_estado_idx" ON "linhas_extrato"("estado");
CREATE INDEX IF NOT EXISTS "linhas_extrato_referencia_idx" ON "linhas_extrato"("referencia");

-- As faturas que já existem ficam sem referência de pagamento: são de antes do
-- canal existir, e continuam a pagar-se como sempre. A referência é atribuída
-- na emissão, não retroativamente — inventá-la agora criaria referências que
-- ninguém escreveu em transferência nenhuma.
