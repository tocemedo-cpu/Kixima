-- Chat de Suporte, Chat Comercial e Trust & Safety.
--
-- O SupportTicket que já existia não muda em NADA — nenhum campo, nenhum
-- valor do enum de estado. Só ganha para onde crescer: quem assumiu a
-- conversa (assigned_to_id) e as mensagens que se seguem à primeira
-- (support_messages).
--
-- O Chat Comercial é inteiramente novo (conversations, conversation_messages)
-- e os alertas de risco também (risk_alerts) — nada aqui troca o
-- comportamento de uma rota já existente.
--
-- Idempotente: pode ser corrido mais do que uma vez sem erro.

-- --- Chat de Suporte, por cima do SupportTicket existente -------------------
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "assigned_to_id" TEXT;

CREATE TABLE IF NOT EXISTS "support_messages" (
  "id"              TEXT NOT NULL,
  "ticket_id"       TEXT NOT NULL,
  "author_id"       TEXT NOT NULL,
  "author_role"     "PersonaRole" NOT NULL,
  "body"            TEXT NOT NULL,
  "attachment_url"  TEXT,
  "attachment_name" TEXT,
  "read_at"         TIMESTAMP(3),
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "support_tickets_assigned_to_id_idx" ON "support_tickets"("assigned_to_id");
CREATE INDEX IF NOT EXISTS "support_messages_ticket_id_idx" ON "support_messages"("ticket_id");

DO $$ BEGIN
  ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_id_fkey"
    FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ticket_id_fkey"
    FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_author_id_fkey"
    FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- --- Chat Comercial -----------------------------------------------------

DO $$ BEGIN
  CREATE TYPE "ConversationStatus" AS ENUM ('ABERTA', 'FECHADA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "conversations" (
  "id"                  TEXT NOT NULL,
  "buyer_company_id"    TEXT NOT NULL,
  "supplier_company_id" TEXT NOT NULL,
  "context_type"        TEXT,
  "context_id"          TEXT,
  "status"              "ConversationStatus" NOT NULL DEFAULT 'ABERTA',
  "created_by_id"       TEXT NOT NULL,
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "conversation_messages" (
  "id"                TEXT NOT NULL,
  "conversation_id"   TEXT NOT NULL,
  "sender_id"         TEXT NOT NULL,
  "sender_company_id" TEXT NOT NULL,
  "body"              TEXT NOT NULL,
  "attachment_url"    TEXT,
  "attachment_name"   TEXT,
  "read_at"           TIMESTAMP(3),
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "conversations_buyer_company_id_idx" ON "conversations"("buyer_company_id");
CREATE INDEX IF NOT EXISTS "conversations_supplier_company_id_idx" ON "conversations"("supplier_company_id");
CREATE INDEX IF NOT EXISTS "conversations_context_type_context_id_idx" ON "conversations"("context_type", "context_id");
CREATE INDEX IF NOT EXISTS "conversation_messages_conversation_id_idx" ON "conversation_messages"("conversation_id");

DO $$ BEGIN
  ALTER TABLE "conversations" ADD CONSTRAINT "conversations_buyer_company_id_fkey"
    FOREIGN KEY ("buyer_company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "conversations" ADD CONSTRAINT "conversations_supplier_company_id_fkey"
    FOREIGN KEY ("supplier_company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_sender_id_fkey"
    FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- --- Trust & Safety -------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "RiskAlertStatus" AS ENUM ('ABERTO', 'EM_ANALISE', 'FALSO_POSITIVO', 'RESOLVIDO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "risk_alerts" (
  "id"               TEXT NOT NULL,
  "conversation_id"  TEXT NOT NULL,
  "message_id"       TEXT,
  "level"            "RiskLevel" NOT NULL,
  "reason"           TEXT NOT NULL,
  "signals"          JSONB,
  "context"          JSONB,
  "status"           "RiskAlertStatus" NOT NULL DEFAULT 'ABERTO',
  "reviewed_by_id"   TEXT,
  "reviewed_at"      TIMESTAMP(3),
  "decision"         TEXT,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "risk_alerts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "risk_alerts_message_id_key" ON "risk_alerts"("message_id");
CREATE INDEX IF NOT EXISTS "risk_alerts_conversation_id_idx" ON "risk_alerts"("conversation_id");
CREATE INDEX IF NOT EXISTS "risk_alerts_status_idx" ON "risk_alerts"("status");

DO $$ BEGIN
  ALTER TABLE "risk_alerts" ADD CONSTRAINT "risk_alerts_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "risk_alerts" ADD CONSTRAINT "risk_alerts_message_id_fkey"
    FOREIGN KEY ("message_id") REFERENCES "conversation_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "risk_alerts" ADD CONSTRAINT "risk_alerts_reviewed_by_id_fkey"
    FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- --- Notificações: três tipos novos, para três contadores separados --------
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SUPORTE_MENSAGEM';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CHAT_COMERCIAL_MENSAGEM';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ALERTA_SEGURANCA';
