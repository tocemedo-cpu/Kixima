-- CreateEnum
CREATE TYPE "ErpSystem" AS ENUM ('SAP_S4HANA', 'PRIMAVERA', 'ORACLE_ERP_CLOUD', 'SAP_ARIBA');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('PURCHASE_ORDER_APPROVED', 'INVOICE_ISSUED', 'GOODS_RECEIVED', 'PAYMENT_COMPLETED');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('PURCHASE_ORDER', 'INVOICE', 'GOODS_RECEIPT', 'PAYMENT');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'COMPLETED', 'FAILED', 'DEAD_LETTER', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUCCESS', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "AuditLevel" AS ENUM ('INFO', 'WARN', 'ERROR');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED');

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "eventType" "EventType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_events" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "event_type" "EventType" NOT NULL,
    "routing_key" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'kixima',
    "payload" JSONB NOT NULL,
    "headers" JSONB,
    "status" "EventStatus" NOT NULL DEFAULT 'RECEIVED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "integration_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp_sync_records" (
    "id" TEXT NOT NULL,
    "integration_event_id" TEXT NOT NULL,
    "erp" "ErpSystem" NOT NULL,
    "entity_type" "EntityType" NOT NULL,
    "external_id" TEXT,
    "status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "request_enc" TEXT,
    "response_enc" TEXT,
    "error" TEXT,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_sync_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "integration_event_id" TEXT,
    "action" TEXT NOT NULL,
    "erp" "ErpSystem",
    "level" "AuditLevel" NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,
    "actor" TEXT NOT NULL DEFAULT 'system',
    "metadata" JSONB,
    "trace_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" TEXT NOT NULL,
    "integration_event_id" TEXT,
    "url" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WebhookStatus" NOT NULL DEFAULT 'PENDING',
    "response_code" INTEGER,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dead_letters" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "event_type" "EventType" NOT NULL,
    "routing_key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT NOT NULL,
    "replayed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dead_letters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp_credentials" (
    "id" TEXT NOT NULL,
    "erp" "ErpSystem" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "config_enc" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_key_key" ON "idempotency_keys"("key");

-- CreateIndex
CREATE INDEX "idempotency_keys_created_at_idx" ON "idempotency_keys"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "integration_events_event_id_key" ON "integration_events"("event_id");

-- CreateIndex
CREATE INDEX "integration_events_status_idx" ON "integration_events"("status");

-- CreateIndex
CREATE INDEX "integration_events_event_type_idx" ON "integration_events"("event_type");

-- CreateIndex
CREATE INDEX "integration_events_received_at_idx" ON "integration_events"("received_at");

-- CreateIndex
CREATE INDEX "erp_sync_records_erp_status_idx" ON "erp_sync_records"("erp", "status");

-- CreateIndex
CREATE INDEX "erp_sync_records_external_id_idx" ON "erp_sync_records"("external_id");

-- CreateIndex
CREATE UNIQUE INDEX "erp_sync_records_integration_event_id_erp_entity_type_key" ON "erp_sync_records"("integration_event_id", "erp", "entity_type");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_level_idx" ON "audit_logs"("level");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "webhook_deliveries_status_idx" ON "webhook_deliveries"("status");

-- CreateIndex
CREATE INDEX "dead_letters_event_type_idx" ON "dead_letters"("event_type");

-- CreateIndex
CREATE INDEX "dead_letters_replayed_idx" ON "dead_letters"("replayed");

-- CreateIndex
CREATE UNIQUE INDEX "erp_credentials_erp_key" ON "erp_credentials"("erp");

-- AddForeignKey
ALTER TABLE "erp_sync_records" ADD CONSTRAINT "erp_sync_records_integration_event_id_fkey" FOREIGN KEY ("integration_event_id") REFERENCES "integration_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_integration_event_id_fkey" FOREIGN KEY ("integration_event_id") REFERENCES "integration_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_integration_event_id_fkey" FOREIGN KEY ("integration_event_id") REFERENCES "integration_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
