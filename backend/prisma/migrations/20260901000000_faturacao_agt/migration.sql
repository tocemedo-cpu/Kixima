-- Base técnica de faturação certificada (AGT).
--
-- A certificação em si é um processo administrativo com a AGT e depende de
-- decisão do contabilista. O que se constrói aqui é a parte que tem de estar
-- CERTA desde a primeira fatura emitida, porque não se corrige para trás:
-- a numeração sequencial sem buracos e a cadeia de integridade.
--
-- PORQUE NÃO SERVE O `reference_counters` QUE JÁ EXISTE. Esse gera números
-- únicos e crescentes, o que basta para uma referência legível. Não basta aqui:
-- ele incrementa numa instrução independente, por isso um INSERT que falhe a
-- seguir CONSOME o número e deixa um buraco. Numa numeração certificada, um
-- buraco não é um detalhe estético — é a pergunta "onde está a fatura 42?" numa
-- inspeção, e não há resposta boa.
--
-- Aqui o contador vive numa linha bloqueada com SELECT ... FOR UPDATE dentro da
-- MESMA transação da fatura. Se a transação abortar, o incremento desaparece com
-- ela e o número volta a estar disponível. É mais lento (serializa as emissões
-- da mesma série) e é o comportamento correto: as faturas de uma série são,
-- por definição, uma fila.

CREATE TABLE IF NOT EXISTS "series_faturacao" (
  "id"           TEXT PRIMARY KEY,
  -- Código da série tal como é declarado à AGT (ex.: "FT2026").
  "codigo"       TEXT NOT NULL,
  "ano"          INTEGER NOT NULL,
  -- Último número EMITIDO. O próximo é este mais um.
  "ultimo_numero" INTEGER NOT NULL DEFAULT 0,
  -- Hash do último documento da série: o elo a que o próximo se agarra.
  "ultimo_hash"  TEXT,
  "ativa"        BOOLEAN NOT NULL DEFAULT true,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "series_faturacao_codigo_ano_key"
  ON "series_faturacao"("codigo", "ano");

ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "serie"           TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "numero_na_serie" INTEGER;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "hash_documento"  TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "hash_anterior"   TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "assinada_em"     TIMESTAMP(3);

-- Duas faturas com o mesmo número na mesma série é o erro que esta tabela toda
-- existe para tornar impossível. A restrição fica na BASE e não só no código:
-- uma corrida entre dois pedidos não pede licença ao serviço.
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_serie_numero_key"
  ON "invoices"("serie", "numero_na_serie")
  WHERE "serie" IS NOT NULL;

-- Percorrer a cadeia de uma série pela ordem de emissão tem de ser barato: é o
-- que a verificação de integridade faz, e é o que se corre quando alguém
-- pergunta se os documentos foram adulterados.
CREATE INDEX IF NOT EXISTS "invoices_serie_numero_idx"
  ON "invoices"("serie", "numero_na_serie");

-- As faturas que já existem ficam SEM série, de propósito, e não numeradas à
-- pressa para trás. Emitir números de uma série certificada para documentos que
-- foram criados antes de a série existir seria fabricar um histórico — que é
-- exatamente o que a cadeia de integridade serve para detetar. Ficam
-- identificáveis: `serie IS NULL` quer dizer "anterior à faturação certificada".
