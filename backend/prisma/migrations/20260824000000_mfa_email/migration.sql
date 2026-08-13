-- Verificação em dois passos por EMAIL.
--
-- Até aqui o único método era o TOTP (app de autenticação). Passa a haver um
-- segundo: o código de 6 dígitos enviado para o email da pessoa, que não obriga
-- a instalar nada. `mfa_method` diz qual dos dois está em uso.
--
-- O código guarda-se em HASH: é uma credencial de acesso, e quem consiga ler a
-- base não pode com isso entrar na conta de ninguém.
--
-- Idempotente (IF NOT EXISTS): a migração pode ser reaplicada sem partir nada.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_method" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_code_hash" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_code_expira_em" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_code_tentativas" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_code_enviado_em" TIMESTAMP(3);

-- Quem JÁ tem a 2FA ativa fê-lo com a app. Sem esta linha ficariam com o método
-- por definir e o login não saberia o que lhes pedir — trancando-os fora.
UPDATE "users" SET "mfa_method" = 'TOTP'
 WHERE "totp_enabled_at" IS NOT NULL AND "mfa_method" IS NULL;
