import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AdaptersModule } from '@app/adapters/adapters.module';
import { CredentialsModule } from '@app/credentials/credentials.module';
import { QUEUES } from '@app/common/constants';
import { MonitoringController } from './monitoring.controller';
import { DashboardController } from './dashboard.controller';
import { MetricsService } from './metrics.service';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.SYNC }), AdaptersModule, CredentialsModule],
  controllers: [MonitoringController, DashboardController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MonitoringModule {}
