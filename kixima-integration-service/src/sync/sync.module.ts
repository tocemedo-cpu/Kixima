import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AdaptersModule } from '@app/adapters/adapters.module';
import { RetryModule } from '@app/retry/retry.module';
import { WebhooksModule } from '@app/webhooks/webhooks.module';
import { QUEUES } from '@app/common/constants';
import { SyncService } from './sync.service';
import { SyncProcessor } from './sync.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUES.SYNC }),
    AdaptersModule,
    RetryModule,
    WebhooksModule,
  ],
  providers: [SyncService, SyncProcessor],
  exports: [SyncService],
})
export class SyncModule {}
