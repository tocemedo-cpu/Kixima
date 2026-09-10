import { EntityType, EventType } from '@prisma/client';
import { eventTypeToEntity, routingKeyToEventType } from './event-mapping';

describe('event-mapping', () => {
  it('mapeia routing keys → EventType', () => {
    expect(routingKeyToEventType('purchase_order.approved')).toBe(EventType.PURCHASE_ORDER_APPROVED);
    expect(routingKeyToEventType('purchase_order.approval_requested')).toBe(EventType.PURCHASE_ORDER_APPROVAL_REQUESTED);
    expect(routingKeyToEventType('invoice.issued')).toBe(EventType.INVOICE_ISSUED);
    expect(routingKeyToEventType('goods.received')).toBe(EventType.GOODS_RECEIVED);
    expect(routingKeyToEventType('payment.completed')).toBe(EventType.PAYMENT_COMPLETED);
    expect(routingKeyToEventType('desconhecido')).toBeNull();
  });

  it('mapeia EventType → EntityType', () => {
    expect(eventTypeToEntity(EventType.PURCHASE_ORDER_APPROVED)).toBe(EntityType.PURCHASE_ORDER);
    // ERP DOA Approval partilha a entidade PURCHASE_ORDER com o evento
    // "aprovada" — são operações diferentes no adapter, não entidades diferentes.
    expect(eventTypeToEntity(EventType.PURCHASE_ORDER_APPROVAL_REQUESTED)).toBe(EntityType.PURCHASE_ORDER);
    expect(eventTypeToEntity(EventType.INVOICE_ISSUED)).toBe(EntityType.INVOICE);
    expect(eventTypeToEntity(EventType.GOODS_RECEIVED)).toBe(EntityType.GOODS_RECEIPT);
    expect(eventTypeToEntity(EventType.PAYMENT_COMPLETED)).toBe(EntityType.PAYMENT);
  });
});
