import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp, { AmqpConnectionManager } from 'amqp-connection-manager';
import { AMQP_CONNECTION } from '@app/common/constants';

/**
 * Ligação resiliente ao RabbitMQ (reconecta automaticamente). Partilhada pelo
 * produtor e pelo consumidor. NÃO cria configuração no sistema principal —
 * apenas assegura a topologia que este microserviço precisa (idempotente).
 */
export const AmqpConnectionProvider: Provider = {
  provide: AMQP_CONNECTION,
  inject: [ConfigService],
  useFactory: (config: ConfigService): AmqpConnectionManager => {
    const url = config.get<string>('rabbitmq.url') ?? 'amqp://guest:guest@localhost:5672';
    return amqp.connect([url], { heartbeatIntervalInSeconds: 15, reconnectTimeInSeconds: 5 });
  },
};
