import { EntityType, EventType } from '@prisma/client';
import { ROUTING_KEYS } from './constants';

/** routing key (broker) → EventType (domínio). */
export function routingKeyToEventType(routingKey: string): EventType | null {
  switch (routingKey) {
    case ROUTING_KEYS.PURCHASE_ORDER_APPROVED:
      return EventType.PURCHASE_ORDER_APPROVED;
    case ROUTING_KEYS.INVOICE_ISSUED:
      return EventType.INVOICE_ISSUED;
    case ROUTING_KEYS.GOODS_RECEIVED:
      return EventType.GOODS_RECEIVED;
    case ROUTING_KEYS.PAYMENT_COMPLETED:
      return EventType.PAYMENT_COMPLETED;
    default:
      return null;
  }
}

/** EventType → EntityType (o que se sincroniza no ERP). */
export function eventTypeToEntity(eventType: EventType): EntityType {
  switch (eventType) {
    case EventType.PURCHASE_ORDER_APPROVED:
      return EntityType.PURCHASE_ORDER;
    case EventType.INVOICE_ISSUED:
      return EntityType.INVOICE;
    case EventType.GOODS_RECEIVED:
      return EntityType.GOODS_RECEIPT;
    case EventType.PAYMENT_COMPLETED:
      return EntityType.PAYMENT;
    default:
      throw new Error(`EventType sem mapeamento de entidade: ${eventType}`);
  }
}
