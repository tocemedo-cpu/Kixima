import { EntityType, ErpSystem, EventStatus, EventType, SyncStatus } from '@prisma/client';
import { SyncProcessor } from './sync.processor';
import { ErpAdapterError } from '@app/adapters/erp-adapter.interface';

const EVENT = {
  id: 'event-1',
  eventId: 'evt-1',
  eventType: EventType.PURCHASE_ORDER_APPROVED,
  tenantId: 'empresa-1',
  payload: { poId: 'po-1' },
};

function makeAdapter(system: ErpSystem, impl: { sync?: jest.Mock } = {}) {
  return {
    system,
    sync: impl.sync ?? jest.fn(async () => ({ erp: system, entityType: EntityType.PURCHASE_ORDER, externalId: 'ext-1', raw: {}, durationMs: 5 })),
    requestApproval: jest.fn(),
  };
}

function makeProcessor(overrides: {
  findSyncRecord?: (args: any) => Promise<{ status: SyncStatus } | null>;
  resolvedAdapters?: any[];
  jobOpts?: { attempts?: number };
  attemptsMade?: number;
} = {}) {
  const upsertSyncRecord = jest.fn();
  const prisma = {
    integrationEvent: {
      findUnique: jest.fn(async () => EVENT),
      update: jest.fn(async () => EVENT),
    },
    erpSyncRecord: {
      findUnique: overrides.findSyncRecord ?? jest.fn(async () => null),
      upsert: upsertSyncRecord,
    },
  } as unknown as ConstructorParameters<typeof SyncProcessor>[0];

  const crypto = { encryptJson: jest.fn(() => 'cifrado') } as unknown as ConstructorParameters<typeof SyncProcessor>[1];
  const audit = {
    info: jest.fn(async () => undefined),
    warn: jest.fn(async () => undefined),
    error: jest.fn(async () => undefined),
  } as unknown as ConstructorParameters<typeof SyncProcessor>[2];
  const credentials = {
    resolveEnabledAdapters: jest.fn(async () => overrides.resolvedAdapters ?? []),
  } as unknown as ConstructorParameters<typeof SyncProcessor>[3];
  const deadLetter = { moveToDeadLetter: jest.fn(async () => undefined) } as unknown as ConstructorParameters<typeof SyncProcessor>[4];
  const webhooks = { notifyKixima: jest.fn(async () => undefined) } as unknown as ConstructorParameters<typeof SyncProcessor>[5];

  const processor = new SyncProcessor(prisma, crypto, audit, credentials, deadLetter, webhooks);

  const job = {
    data: { integrationEventId: EVENT.id },
    opts: { attempts: overrides.jobOpts?.attempts ?? 3 },
    attemptsMade: overrides.attemptsMade ?? 1,
  } as any;

  return { processor, prisma, job, upsertSyncRecord };
}

// N6 da auditoria: um retry (por outro adapter ter falhado) reenviava a
// TODOS os adapters resolvidos, incluindo os que já tinham tido sucesso na
// tentativa anterior — duplicando POs/faturas/pagamentos já criados no ERP.
describe('SyncProcessor — não reenvia a adapters já sincronizados com sucesso', () => {
  it('salta o adapter cujo ErpSyncRecord já está SUCCESS, e sincroniza normalmente o que ainda não foi', async () => {
    const sapSync = jest.fn();
    const aribaSync = jest.fn(async () => ({ erp: ErpSystem.SAP_ARIBA, entityType: EntityType.PURCHASE_ORDER, externalId: 'ariba-1', raw: {}, durationMs: 3 }));
    const sap = makeAdapter(ErpSystem.SAP_S4HANA, { sync: sapSync });
    const ariba = makeAdapter(ErpSystem.SAP_ARIBA, { sync: aribaSync });

    const { processor, job } = makeProcessor({
      resolvedAdapters: [{ adapter: sap }, { adapter: ariba }],
      findSyncRecord: async (args: any) => (args.where.integrationEventId_erp_entityType.erp === ErpSystem.SAP_S4HANA ? { status: SyncStatus.SUCCESS } : null),
    });

    await processor.process(job);

    expect(sapSync).not.toHaveBeenCalled();
    expect(aribaSync).toHaveBeenCalledTimes(1);
  });

  it('sincroniza normalmente quando nenhum adapter tem sucesso registado ainda (primeira tentativa)', async () => {
    const sapSync = jest.fn(async () => ({ erp: ErpSystem.SAP_S4HANA, entityType: EntityType.PURCHASE_ORDER, externalId: 'sap-1', raw: {}, durationMs: 4 }));
    const sap = makeAdapter(ErpSystem.SAP_S4HANA, { sync: sapSync });

    const { processor, job, prisma } = makeProcessor({
      resolvedAdapters: [{ adapter: sap }],
      findSyncRecord: async () => null,
    });

    await processor.process(job);

    expect(sapSync).toHaveBeenCalledTimes(1);
    expect(prisma.integrationEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: EventStatus.COMPLETED }) }),
    );
  });

  it('não relança sobre o adapter já SUCCESS mesmo quando outro falha de forma retryable', async () => {
    const sapSync = jest.fn();
    const aribaSync = jest.fn(async () => {
      throw new ErpAdapterError('timeout', ErpSystem.SAP_ARIBA, true, 504);
    });
    const sap = makeAdapter(ErpSystem.SAP_S4HANA, { sync: sapSync });
    const ariba = makeAdapter(ErpSystem.SAP_ARIBA, { sync: aribaSync });

    const { processor, job } = makeProcessor({
      resolvedAdapters: [{ adapter: sap }, { adapter: ariba }],
      findSyncRecord: async (args: any) => (args.where.integrationEventId_erp_entityType.erp === ErpSystem.SAP_S4HANA ? { status: SyncStatus.SUCCESS } : null),
      attemptsMade: 1,
      jobOpts: { attempts: 3 },
    });

    await expect(processor.process(job)).rejects.toThrow();
    expect(sapSync).not.toHaveBeenCalled();
    expect(aribaSync).toHaveBeenCalledTimes(1);
  });
});
