import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { EventStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@app/common/prisma/prisma.service';
import { AuditService } from '@app/audit/audit.service';
import { QUEUES } from '@app/common/constants';
import { EventEnvelope } from '@app/common/types/erp.types';

/**
 * Orquestrador de entrada: recebe o envelope do broker, garante idempotência,
 * persiste o IntegrationEvent e enfileira o trabalho de sincronização (BullMQ).
 * Devolve um resultado que diz ao consumidor AMQP se deve dar ack.
 */
export interface IngestResult {
  accepted: boolean;
  duplicate: boolean;
  integrationEventId?: string;
}

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    @InjectQueue(QUEUES.SYNC) private readonly syncQueue: Queue,
  ) {}

  async ingest(envelope: EventEnvelope): Promise<IngestResult> {
    // 1) Idempotência — tenta reservar a chave; se já existir, é duplicado.
    try {
      await this.prisma.idempotencyKey.create({
        data: { key: envelope.eventId, eventType: envelope.eventType },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        await this.audit.warn('event.duplicate', `Evento duplicado ignorado: ${envelope.eventId}`, {
          traceId: envelope.eventId,
        });
        return { accepted: true, duplicate: true };
      }
      throw err;
    }

    // 2) Persiste o evento.
    const event = await this.prisma.integrationEvent.create({
      data: {
        eventId: envelope.eventId,
        eventType: envelope.eventType,
        routingKey: envelope.routingKey,
        source: envelope.source,
        payload: envelope.payload as Prisma.InputJsonValue,
        headers: envelope.headers ? (envelope.headers as Prisma.InputJsonValue) : Prisma.JsonNull,
        status: EventStatus.RECEIVED,
      },
    });

    await this.audit.info('event.received', `Evento recebido: ${envelope.routingKey}`, {
      integrationEventId: event.id,
      traceId: envelope.eventId,
    });

    // 3) Enfileira o job com retry/backoff exponencial (config em RetryModule).
    await this.syncQueue.add(
      'sync-erp',
      { integrationEventId: event.id },
      {
        jobId: event.id,
        attempts: this.config.get<number>('bullmq.attempts') ?? 5,
        backoff: { type: 'exponential', delay: this.config.get<number>('bullmq.backoffMs') ?? 5000 },
        removeOnComplete: 1000,
        removeOnFail: false,
      },
    );

    return { accepted: true, duplicate: false, integrationEventId: event.id };
  }
}
