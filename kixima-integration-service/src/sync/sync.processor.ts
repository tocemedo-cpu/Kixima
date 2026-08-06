import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { EventStatus, SyncStatus } from '@prisma/client';
import { PrismaService } from '@app/common/prisma/prisma.service';
import { CryptoService } from '@app/crypto/crypto.service';
import { AuditService } from '@app/audit/audit.service';
import { CredentialsService } from '@app/credentials/credentials.service';
import { ErpAdapterError } from '@app/adapters/erp-adapter.interface';
import { DeadLetterService } from '@app/retry/dead-letter.service';
import { WebhookProducer } from '@app/webhooks/webhook.producer';
import { QUEUES } from '@app/common/constants';
import { eventTypeToEntity } from '@app/common/event-mapping';

interface SyncJobData {
  integrationEventId: string;
}

/**
 * Worker BullMQ que executa a sincronização com os ERPs.
 * Fan-out: um evento é empurrado para todos os adapters ativos. Cada resultado
 * é auditado e cifrado. Falhas retryable relançam (BullMQ faz backoff); quando
 * as tentativas esgotam, o evento vai para Dead Letter.
 */
@Processor(QUEUES.SYNC)
export class SyncProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
    private readonly credentials: CredentialsService,
    private readonly deadLetter: DeadLetterService,
    private readonly webhooks: WebhookProducer,
  ) {
    super();
  }

  async process(job: Job<SyncJobData>): Promise<void> {
    const { integrationEventId } = job.data;
    const event = await this.prisma.integrationEvent.findUnique({ where: { id: integrationEventId } });
    if (!event) {
      this.logger.warn(`Evento inexistente: ${integrationEventId}`);
      return;
    }

    await this.prisma.integrationEvent.update({
      where: { id: event.id },
      data: { status: EventStatus.PROCESSING, attempts: { increment: 1 } },
    });

    const entityType = eventTypeToEntity(event.eventType);
    // Resolve os ERPs ativos PARA ESTE TENANT (config própria + global '*').
    const resolved = await this.credentials.resolveEnabledAdapters(event.tenantId);
    if (resolved.length === 0) {
      await this.audit.warn(
        'sync.no_adapters',
        `Sem ERP ativo para o tenant "${event.tenantId ?? '—'}" — evento concluído (no-op).`,
        { integrationEventId: event.id },
      );
      await this.prisma.integrationEvent.update({
        where: { id: event.id },
        data: { status: EventStatus.COMPLETED, processedAt: new Date() },
      });
      return;
    }

    const failures: ErpAdapterError[] = [];

    for (const { adapter } of resolved) {
      const started = Date.now();
      try {
        const result = await adapter.sync(entityType, event.payload, {
          eventId: event.eventId,
          eventType: event.eventType,
          traceId: event.eventId,
        });

        await this.prisma.erpSyncRecord.upsert({
          where: { integrationEventId_erp_entityType: { integrationEventId: event.id, erp: adapter.system, entityType } },
          create: {
            integrationEventId: event.id,
            erp: adapter.system,
            entityType,
            externalId: result.externalId,
            status: SyncStatus.SUCCESS,
            responseEnc: this.crypto.encryptJson(result.raw),
            durationMs: result.durationMs,
          },
          update: {
            status: SyncStatus.SUCCESS,
            externalId: result.externalId,
            responseEnc: this.crypto.encryptJson(result.raw),
            durationMs: result.durationMs,
            attempts: { increment: 1 },
            error: null,
          },
        });

        await this.audit.info('sync.success', `Sincronizado em ${adapter.system} (${result.externalId ?? 's/ id'})`, {
          integrationEventId: event.id,
          erp: adapter.system,
          metadata: { durationMs: result.durationMs },
        });
      } catch (err) {
        const adapterErr = err instanceof ErpAdapterError ? err : new ErpAdapterError((err as Error).message, adapter.system, true);
        failures.push(adapterErr);

        await this.prisma.erpSyncRecord.upsert({
          where: { integrationEventId_erp_entityType: { integrationEventId: event.id, erp: adapter.system, entityType } },
          create: {
            integrationEventId: event.id,
            erp: adapter.system,
            entityType,
            status: SyncStatus.FAILED,
            error: adapterErr.message,
            durationMs: Date.now() - started,
          },
          update: { status: SyncStatus.FAILED, error: adapterErr.message, attempts: { increment: 1 } },
        });

        await this.audit.error('sync.failure', adapterErr.message, {
          integrationEventId: event.id,
          erp: adapter.system,
          metadata: { retryable: adapterErr.retryable, statusCode: adapterErr.statusCode ?? null },
        });
      }
    }

    if (failures.length === 0) {
      await this.prisma.integrationEvent.update({
        where: { id: event.id },
        data: { status: EventStatus.COMPLETED, processedAt: new Date(), lastError: null },
      });
      await this.webhooks.notifyKixima(event.id, 'integration.completed', {
        eventId: event.eventId,
        eventType: event.eventType,
      });
      return;
    }

    // Há falhas. Se alguma é retryable e ainda há tentativas, relança para o BullMQ.
    const retryable = failures.some((f) => f.retryable);
    const attemptsLeft = (job.opts.attempts ?? 1) - job.attemptsMade;
    if (retryable && attemptsLeft > 0) {
      await this.prisma.integrationEvent.update({
        where: { id: event.id },
        data: { status: EventStatus.RECEIVED, lastError: failures.map((f) => f.message).join(' | ') },
      });
      throw new Error(`Sincronização parcial/ falhada — retry (${attemptsLeft} restantes): ${failures.map((f) => f.message).join(' | ')}`);
    }

    // Esgotou / não-retryable → Dead Letter.
    await this.moveToDeadLetter(event.id, failures);
  }

  private async moveToDeadLetter(integrationEventId: string, failures: ErpAdapterError[]): Promise<void> {
    const event = await this.prisma.integrationEvent.findUniqueOrThrow({ where: { id: integrationEventId } });
    const lastError = failures.map((f) => `${f.erp}: ${f.message}`).join(' | ');
    await this.prisma.integrationEvent.update({
      where: { id: event.id },
      data: { status: EventStatus.DEAD_LETTER, lastError, processedAt: new Date() },
    });
    await this.deadLetter.capture(event, lastError);
    await this.webhooks.notifyKixima(event.id, 'integration.failed', { eventId: event.eventId, error: lastError });
  }
}
