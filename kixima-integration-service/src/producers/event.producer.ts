import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import type { ConfirmChannel } from 'amqplib';
import { AMQP_CONNECTION } from '@app/common/constants';

/**
 * Publica mensagens no RabbitMQ: eventos de retorno da integração e mensagens
 * para a Dead Letter Exchange do microserviço.
 */
@Injectable()
export class EventProducer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventProducer.name);
  private channel!: ChannelWrapper;
  private readonly exchange: string;
  private readonly dlx: string;
  private readonly dlq: string;

  constructor(
    @Inject(AMQP_CONNECTION) private readonly connection: AmqpConnectionManager,
    config: ConfigService,
  ) {
    this.exchange = config.get<string>('rabbitmq.exchange') ?? 'kixima.events';
    this.dlx = config.get<string>('rabbitmq.dlx') ?? 'kixima.integration.dlx';
    this.dlq = config.get<string>('rabbitmq.dlq') ?? 'kixima.integration.dlq';
  }

  onModuleInit(): void {
    this.channel = this.connection.createChannel({
      json: true,
      setup: async (ch: ConfirmChannel): Promise<void> => {
        // Topologia própria do microserviço (idempotente; não altera o sistema principal).
        await ch.assertExchange(this.exchange, 'topic', { durable: true });
        await ch.assertExchange(this.dlx, 'topic', { durable: true });
        await ch.assertQueue(this.dlq, { durable: true });
        await ch.bindQueue(this.dlq, this.dlx, '#');
      },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
  }

  /** Publica um evento de retorno no exchange principal. */
  async publish(routingKey: string, message: Record<string, unknown>): Promise<void> {
    await this.channel.publish(this.exchange, routingKey, message, { persistent: true });
  }

  /** Envia uma mensagem para a Dead Letter Exchange do microserviço. */
  async publishToDlq(routingKey: string, message: Record<string, unknown>): Promise<void> {
    try {
      await this.channel.publish(this.dlx, routingKey, message, { persistent: true });
    } catch (err) {
      this.logger.error(`Falha ao publicar na DLQ: ${(err as Error).message}`);
    }
  }
}
