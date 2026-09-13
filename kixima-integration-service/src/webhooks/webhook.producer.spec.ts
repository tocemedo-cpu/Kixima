import { EventType, WebhookStatus } from '@prisma/client';
import { WebhookProducer } from './webhook.producer';

function makeProducer(overrides: {
  findFirst?: (args: unknown) => Promise<{ id: string } | null>;
  findFirstIntegrationEvent?: (args: unknown) => Promise<{ tenantId: string | null } | null>;
} = {}) {
  const prisma = {
    webhookDelivery: {
      findFirst: overrides.findFirst ?? (async () => null),
    },
    integrationEvent: {
      findFirst: overrides.findFirstIntegrationEvent ?? (async () => null),
    },
  } as unknown as ConstructorParameters<typeof WebhookProducer>[0];

  const crypto = {} as ConstructorParameters<typeof WebhookProducer>[1];

  const config = {
    get: () => undefined,
  } as unknown as ConstructorParameters<typeof WebhookProducer>[2];

  return new WebhookProducer(prisma, crypto, config);
}

describe('WebhookProducer.jaEncaminhadoComSucesso', () => {
  it('devolve false quando não há nenhuma entrega DELIVERED para este (type, poId)', async () => {
    const producer = makeProducer({ findFirst: async () => null });
    expect(await producer.jaEncaminhadoComSucesso('payment.confirmed', 'po-1')).toBe(false);
  });

  it('devolve true quando já existe uma entrega DELIVERED para este (type, poId)', async () => {
    const producer = makeProducer({ findFirst: async () => ({ id: 'delivery-1' }) });
    expect(await producer.jaEncaminhadoComSucesso('payment.confirmed', 'po-1')).toBe(true);
  });

  it('filtra por status DELIVERED e pelos dois caminhos JSON (type, data.poId)', async () => {
    let capturedArgs: any;
    const producer = makeProducer({
      findFirst: async (args) => {
        capturedArgs = args;
        return null;
      },
    });

    await producer.jaEncaminhadoComSucesso('purchase_order.approval_decided', 'po-42');

    expect(capturedArgs.where.status).toBe(WebhookStatus.DELIVERED);
    expect(capturedArgs.where.AND).toEqual([
      { payload: { path: ['type'], equals: 'purchase_order.approval_decided' } },
      { payload: { path: ['data', 'poId'], equals: 'po-42' } },
    ]);
  });
});

// N5 da auditoria: o segredo por-tenant só prova quem assinou o webhook,
// nunca que a PO no corpo é dele — tenantIdParaPo resolve o dono real a
// partir do evento approval_requested que a KIXIMA publicou para essa PO.
describe('WebhookProducer.tenantIdParaPo', () => {
  it('devolve null quando não há nenhum evento approval_requested para esta PO', async () => {
    const producer = makeProducer({ findFirstIntegrationEvent: async () => null });
    expect(await producer.tenantIdParaPo('po-1')).toBeNull();
  });

  it('devolve o tenantId do evento approval_requested encontrado', async () => {
    const producer = makeProducer({ findFirstIntegrationEvent: async () => ({ tenantId: 'empresa-1' }) });
    expect(await producer.tenantIdParaPo('po-1')).toBe('empresa-1');
  });

  it('filtra por eventType PURCHASE_ORDER_APPROVAL_REQUESTED e pelo path payload.poId', async () => {
    let capturedArgs: any;
    const producer = makeProducer({
      findFirstIntegrationEvent: async (args) => {
        capturedArgs = args;
        return null;
      },
    });

    await producer.tenantIdParaPo('po-77');

    expect(capturedArgs.where.eventType).toBe(EventType.PURCHASE_ORDER_APPROVAL_REQUESTED);
    expect(capturedArgs.where.payload).toEqual({ path: ['poId'], equals: 'po-77' });
  });
});
