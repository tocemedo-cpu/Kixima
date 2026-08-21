-- Série de faturação certificada PASSA A SER POR EMPRESA, não uma série
-- global da KIXIMA. Cada fornecedor é o emitente fiscal das suas próprias
-- faturas (a KIXIMA nunca compra para revender — só garante o pagamento),
-- por isso a numeração e a cadeia de integridade têm de ser isoladas por
-- fornecedor: partilhar uma série entre empresas diferentes intercalaria a
-- numeração de fornecedores distintos, o que nenhuma AGT aceitaria de nenhum
-- dos dois.
--
-- Nula até a empresa ter a sua série declarada — desligado por omissão,
-- mesma regra de sempre. Não migra dados: as faturas já emitidas com a série
-- global antiga ficam exatamente como estão (histórico não se reescreve).

ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "serie_fiscal" TEXT;
