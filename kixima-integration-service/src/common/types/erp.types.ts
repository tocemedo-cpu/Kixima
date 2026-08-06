/**
 * Tipos de domínio da integração ERP (TypeScript estrito).
 * O envelope é agnóstico ao ERP; cada adapter mapeia para o seu formato.
 */
import { EntityType, ErpSystem, EventType } from '@prisma/client';

export { EntityType, ErpSystem, EventType };

/** Envelope canónico recebido do RabbitMQ (exchange kixima.events). */
export interface EventEnvelope<T = Record<string, unknown>> {
  /** Id único da mensagem (idempotência). */
  eventId: string;
  /** Routing key original (ex.: purchase_order.approved). */
  routingKey: string;
  /** Tipo de evento normalizado. */
  eventType: EventType;
  /** Tenant (operadora/cliente) dono da transação — chave das credenciais ERP. */
  tenantId?: string | null;
  /** Origem lógica do evento. */
  source: string;
  /** Momento em que o evento ocorreu (ISO 8601). */
  occurredAt: string;
  /** Cabeçalhos AMQP relevantes. */
  headers?: Record<string, unknown>;
  /** Corpo de negócio do evento. */
  payload: T;
}

/** Resultado devolvido por um adapter ao sincronizar uma entidade. */
export interface ErpSyncResult {
  erp: ErpSystem;
  entityType: EntityType;
  /** Id do documento criado/atualizado no ERP. */
  externalId: string | null;
  /** Resposta bruta do ERP (será cifrada em repouso). */
  raw: unknown;
  /** Duração da chamada, em ms. */
  durationMs: number;
}

/** Contexto passado ao adapter para uma operação. */
export interface ErpSyncContext {
  eventId: string;
  eventType: EventType;
  traceId?: string;
}

/** Payloads de negócio (forma mínima esperada de cada evento). */
export interface PurchaseOrderApprovedPayload {
  poId: string;
  reference: string;
  buyer: { taxId: string; name: string };
  supplier: { taxId: string; name: string };
  currency: string;
  totalAmount: number;
  lines: Array<{
    sku?: string;
    description: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  approvedAt: string;
}

export interface InvoiceIssuedPayload {
  invoiceId: string;
  reference: string;
  poReference?: string;
  supplier: { taxId: string; name: string };
  currency: string;
  amount: number;
  issuedAt: string;
  dueAt: string;
}

export interface GoodsReceivedPayload {
  goodsReceiptId: string;
  poReference: string;
  receivedAt: string;
  lines: Array<{ sku?: string; description: string; quantityReceived: number }>;
}

export interface PaymentCompletedPayload {
  paymentId: string;
  invoiceReference: string;
  amount: number;
  currency: string;
  paidAt: string;
  method: string;
}
