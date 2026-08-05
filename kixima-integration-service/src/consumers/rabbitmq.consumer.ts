import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import type { ConfirmChannel, ConsumeMessage } from 'amqplib';
import { v4 as uuidv4 } from 'uuid';
import { AMQP_CONNECTION, SUBSCRIBED_ROUTING_KEYS } from '@app/common/constants';
import { routingKeyToEventType } from '@app/common/event-mapping';
import { EventEnvelope } from '@app/common/types/erp.types';
import { SyncService } from '@app/sync/sync.service';

/**
 * Consumidor do RabbitMQ. Liga uma fila própria do microserviço ao exchange
 * `kixima.events` (topic) para as routing keys de interesse, com Dead Letter
 * Exchange. Cada mensagem é entregue ao SyncService (idempotência + fila BullMQ)
 * e só depois confirmada (ack). Falhas de ingestão → nack sem requeue (DLX).
 */
@Injectable()
export class RabbitmqConsumer implements OnModuleInit {
  private readonly logger = new Logger(RabbitmqConsumer.name);
  private channel!: ChannelWrapper;

  private readonly exchange: string;
  private readonly queue: string;
  private readonly dlx: string;
  private readonly prefetch: number;

  constructor(
    @Inject(AMQP_CONNECTION) private readonly connection: AmqpConnectionManager,
    config: ConfigService,
    private readonly sync: SyncService,
  ) {
    this.exchange = config.get<string>('rabbitmq.exchange') ?? 'kixima.events';
    this.queue = config.get<string>('rabbitmq.queue') ?? 'kixima.integration.q';
    this.dlx = config.get<string>('rabbitmq.dlx') ?? 'kixima.integration.dlx';
    this.prefetch = config.get<number>('rabbitmq.prefetch') ?? 10;
  }

  async onModuleInit(): Promise<void> {
    this.channel = this.connection.createChannel({
      json: false,
      setup: async (ch: ConfirmChannel): Promise<void> => {
        await ch.assertExchange(this.exchange, 'topic', { durable: true });
        await ch.assertExchange(this.dlx, 'topic', { durable: true });
        await ch.assertQueue(this.queue, { durable: true, deadLetterExchange: this.dlx });
        for (const rk of SUBSCRIBED_ROUTING_KEYS) {
          await ch.bindQueue(this.queue, this.exchange, rk);
        }
        await ch.prefetch(this.prefetch);
      },
    });

    await this.channel.consume(this.queue, (msg) => this.onMessage(msg), { noAck: false });
    this.logger.log(
      `A consumir "${this.queue}" ← exchange "${this.exchange}" [${SUBSCRIBED_ROUTING_KEYS.join(', ')}]`,
    );
  }

  private async onMessage(msg: ConsumeMessage | null): Promise<void> {
    if (!msg) return;
    try {
      const routingKey = msg.fields.routingKey;
      const eventType = routingKeyToEventType(routingKey);
      if (!eventType) {
        this.logger.warn(`Routing key não suportada, descartada: ${routingKey}`);
        this.channel.ack(msg);
        return;
      }

      const raw = msg.content.toString('utf8');
      const content = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      const envelope: EventEnvelope = {
        eventId: (msg.properties.messageId as string) || (content.eventId as string) || uuidv4(),
        routingKey,
        eventType,
        source: (content.source as string) ?? 'kixima',
        occurredAt: (content.occurredAt as string) ?? new Date().toISOString(),
        headers: (msg.properties.headers as Record<string, unknown>) ?? undefined,
        payload: (content.payload as Record<string, unknown>) ?? content,
      };

      await this.sync.ingest(envelope);
      this.channel.ack(msg);
    } catch (err) {
      this.logger.error(`Falha ao ingerir mensagem: ${(err as Error).message}`);
      // Sem requeue: a fila tem deadLetterExchange → segue para a DLX.
      this.channel.nack(msg, false, false);
    }
  }
}
