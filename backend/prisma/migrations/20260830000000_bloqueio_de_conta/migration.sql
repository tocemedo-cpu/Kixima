-- Bloqueio de conta por tentativas falhadas.
--
-- Na base e não em memória: o contador do rate limiter reinicia a cada arranque
-- do processo, e no plano gratuito o contentor reinicia sozinho. Um bloqueio
-- que se desfaz nesse momento é um bloqueio que não existe.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "falhas_seguidas" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ultima_falha_em" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bloqueado_ate" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "aviso_bloqueio_em" TIMESTAMP(3);

-- Encontrar as contas sob ataque tem de ser barato: é uma consulta que se faz
-- quando já há um problema, e nessa altura o sistema está a ser martelado.
CREATE INDEX IF NOT EXISTS "users_bloqueado_ate_idx" ON "users"("bloqueado_ate");
