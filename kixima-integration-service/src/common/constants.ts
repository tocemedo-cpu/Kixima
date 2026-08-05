/**
 * Constantes partilhadas do microserviço de integração.
 */

/** Routing keys dos eventos consumidos do exchange `kixima.events`. */
export const ROUTING_KEYS = {
  PURCHASE_ORDER_APPROVED: 'purchase_order.approved',
  INVOICE_ISSUED: 'invoice.issued',
  GOODS_RECEIVED: 'goods.received',
  PAYMENT_COMPLETED: 'payment.completed',
} as const;

export type RoutingKey = (typeof ROUTING_KEYS)[keyof typeof ROUTING_KEYS];

/** Todas as routing keys que a fila subscreve no exchange. */
export const SUBSCRIBED_ROUTING_KEYS: RoutingKey[] = Object.values(ROUTING_KEYS);

/** Nome das filas BullMQ. */
export const QUEUES = {
  SYNC: 'erp-sync',
  WEBHOOK: 'webhook-callback',
} as const;

/** Tokens de injeção para os adapters ERP. */
export const ERP_ADAPTERS = 'ERP_ADAPTERS';

/** Cliente do broker AMQP (amqp-connection-manager). */
export const AMQP_CONNECTION = 'AMQP_CONNECTION';
