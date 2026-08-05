import { Injectable } from '@nestjs/common';
import { IntegrationEvent, Prisma } from '@prisma/client';
import { PrismaService } from '@app/common/prisma/prisma.service';
import { AuditService } from '@app/audit/audit.service';
import { EventProducer } from '@app/producers/event.producer';

/**
 * Dead Letter — captura eventos que esgotaram as tentativas de sincronização.
 * Persiste para inspeção/replay e publica na DLQ do RabbitMQ (se disponível).
 */
@Injectable()
export class DeadLetterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly producer: EventProducer,
  ) {}

  async capture(event: IntegrationEvent, lastError: string): Promise<void> {
    await this.prisma.deadLetter.create({
      data: {
        eventId: event.eventId,
        eventType: event.eventType,
        routingKey: event.routingKey,
        payload: event.payload as Prisma.InputJsonValue,
        attempts: event.attempts,
        lastError,
      },
    });
    await this.audit.error('event.dead_letter', `Evento movido para Dead Letter: ${event.eventId}`, {
      integrationEventId: event.id,
      metadata: { lastError },
    });
    await this.producer.publishToDlq(event.routingKey, {
      eventId: event.eventId,
      eventType: event.eventType,
      error: lastError,
    });
  }

  /** Reprocessa um item da DLQ (usado pelo painel de monitorização). */
  async markReplayed(deadLetterId: string): Promise<void> {
    await this.prisma.deadLetter.update({ where: { id: deadLetterId }, data: { replayed: true } });
  }
}
