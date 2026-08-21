-- Avisos escalonados de expiração da subscrição (30/7/3/1/0 dias e durante o
-- período de tolerância) — ver planService.js e subscriptionExpiryJob.js.
--
-- À parte de propósito: o Postgres não deixa USAR um valor de enum adicionado
-- na MESMA transação em que foi criado (ver a migração das notificações de
-- subscrição, 20260829010000).
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SUBSCRICAO_A_EXPIRAR';

-- Último patamar de aviso já enviado a esta empresa (D30/D7/D3/D1/D0/
-- GRACE_INICIO/GRACE_META). Idempotente: pode ser corrido mais do que uma vez
-- sem erro.
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "ultimo_aviso_subscricao_tier" TEXT;
