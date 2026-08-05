import { Module } from '@nestjs/common';
import { AmqpConnectionProvider } from './amqp.provider';
import { EventProducer } from './event.producer';
import { AMQP_CONNECTION } from '@app/common/constants';

@Module({
  providers: [AmqpConnectionProvider, EventProducer],
  exports: [EventProducer, AMQP_CONNECTION],
})
export class ProducersModule {}
