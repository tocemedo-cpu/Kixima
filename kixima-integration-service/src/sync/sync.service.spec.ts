import { Prisma } from '@prisma/client';
import { SyncService } from './sync.service';
import { EventEnvelope } from '@app/common/types/erp.types';

const ENVELOPE: EventEnvelope = {
  eventId: 'evt-1',
  eventType: 'PURCHASE_ORDER_APPROVED' as any,
  routingKey: 'purchase_order.approved',
  source: 'kixima',
  occurredAt: '2026-09-13T00:00:00.000Z',
  payload: { poId: 'po-1' },
};

function makeService(overrides: {
  idempotencyKeyCreate?: (args: unknown) => Promise<unknown>;
  integrationEventCreate?: (args: unknown) => Promise<{ id: string }>;
} = {}) {
  const idempotencyKeyCreate = jest.fn(overrides.idempotencyKeyCreate ?? (async () => ({})));
  const integrationEventCreate = jest.fn(overrides.integrationEventCreate ?? (async () => ({ id: 'event-1' })));

  const tx = {
    idempotencyKey: { create: idempotencyKeyCreate },
    integrationEvent: { create: integrationEventCreate },
  };

  const prisma = {
    $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx)),
  } as unknown as ConstructorParameters<typeof SyncService>[0];

  const audit = {
    info: jest.fn(async () => undefined),
    warn: jest.fn(async () => undefined),
  } as unknown as ConstructorParameters<typeof SyncService>[1];

  const config = { get: () => undefined } as unknown as ConstructorParameters<typeof SyncService>[2];
  const syncQueueAdd = jest.fn(async () => undefined);
  const syncQueue = { add: syncQueueAdd } as unknown as ConstructorParameters<typeof SyncService>[3];

  const service = new SyncService(prisma, audit, config, syncQueue);
  return { service, prisma, audit, syncQueueAdd, idempotencyKeyCreate, integrationEventCreate };
}

// N4/#4 da auditoria: a chave de idempotência e o evento tinham de ser
// persistidos na MESMA transação — antes, um crash entre as duas escritas
// (ou uma reentrega apanhando só a chave já criada) fazia o evento ser
// tratado como "duplicado legítimo" sem nunca ter sido processado nem
// enfileirado, perdendo a mensagem para sempre.
describe('SyncService.ingest — idempotência e persistência atómicas', () => {
  it('grava a chave e o evento na MESMA chamada a $transaction, e só depois enfileira', async () => {
    const { service, prisma, syncQueueAdd } = makeService();

    const result = await service.ingest(ENVELOPE);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ accepted: true, duplicate: false, integrationEventId: 'event-1' });
    expect(syncQueueAdd).toHaveBeenCalledWith(
      'sync-erp',
      { integrationEventId: 'event-1' },
      expect.objectContaining({ jobId: 'event-1' }),
    );
  });

  it('devolve duplicate:true e NÃO enfileira quando a chave de idempotência já existe (P2002)', async () => {
    const { service, syncQueueAdd, integrationEventCreate } = makeService({
      idempotencyKeyCreate: async () => {
        throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '5.0.0' });
      },
    });

    const result = await service.ingest(ENVELOPE);

    expect(result).toEqual({ accepted: true, duplicate: true });
    expect(syncQueueAdd).not.toHaveBeenCalled();
    // A transação nunca chegou a criar o IntegrationEvent — confirma que as
    // duas escritas vivem dentro da mesma transação, não em chamadas soltas.
    expect(integrationEventCreate).not.toHaveBeenCalled();
  });

  it('propaga (não engole) um erro que não seja P2002 — nunca trata uma falha real como duplicado', async () => {
    const { service, syncQueueAdd } = makeService({
      idempotencyKeyCreate: async () => {
        throw new Error('Postgres indisponível');
      },
    });

    await expect(service.ingest(ENVELOPE)).rejects.toThrow('Postgres indisponível');
    expect(syncQueueAdd).not.toHaveBeenCalled();
  });

  it('se a criação do IntegrationEvent falhar dentro da transação, a chave de idempotência não fica "presa" — a chamada inteira rejeita', async () => {
    // Simula o que aconteceria numa transação real: se integrationEvent.create
    // falha, o Postgres reverte TAMBÉM o idempotencyKey.create já feito nesta
    // mesma transação — uma reentrega seguinte encontra a chave livre outra
    // vez (não fica presa como "duplicado" de um evento que nunca existiu).
    const { service, syncQueueAdd } = makeService({
      integrationEventCreate: async () => {
        throw new Error('Falha ao persistir o evento');
      },
    });

    await expect(service.ingest(ENVELOPE)).rejects.toThrow('Falha ao persistir o evento');
    expect(syncQueueAdd).not.toHaveBeenCalled();
  });
});
