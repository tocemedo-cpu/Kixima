import { WebhookStatus } from '@prisma/client';
import { WebhookProducer } from './webhook.producer';

function makeProducer(overrides: {
  findFirst?: (args: unknown) => Promise<{ id: string } | null>;
} = {}) {
  const prisma = {
    webhookDelivery: {
      findFirst: overrides.findFirst ?? (async () => null),
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
