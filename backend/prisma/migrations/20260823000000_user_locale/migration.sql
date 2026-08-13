-- Idioma de cada utilizador.
--
-- Os emails saíam sempre em português, fosse qual fosse o idioma que a pessoa
-- escolheu na plataforma. A escolha vivia só no localStorage do browser, que o
-- servidor não vê — e é o servidor que escreve os convites, a recuperação de
-- senha e os avisos de fatura.
--
-- Idempotente: pode ser corrido mais do que uma vez sem erro.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "locale" TEXT;
