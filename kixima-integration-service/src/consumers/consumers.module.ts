import { Module } from '@nestjs/common';
import { ProducersModule } from '@app/producers/producers.module';
import { SyncModule } from '@app/sync/sync.module';
import { RabbitmqConsumer } from './rabbitmq.consumer';

@Module({
  imports: [ProducersModule, SyncModule],
  providers: [RabbitmqConsumer],
})
export class ConsumersModule {}
