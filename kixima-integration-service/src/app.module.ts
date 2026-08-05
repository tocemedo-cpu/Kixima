import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { LoggerModule } from 'nestjs-pino';

import configuration from '@app/common/config/configuration';
import { PrismaModule } from '@app/common/prisma/prisma.module';
import { CryptoModule } from '@app/crypto/crypto.module';
import { AuditModule } from '@app/audit/audit.module';
import { ProducersModule } from '@app/producers/producers.module';
import { AdaptersModule } from '@app/adapters/adapters.module';
import { RetryModule } from '@app/retry/retry.module';
import { WebhooksModule } from '@app/webhooks/webhooks.module';
import { SyncModule } from '@app/sync/sync.module';
import { ConsumersModule } from '@app/consumers/consumers.module';
import { MonitoringModule } from '@app/monitoring/monitoring.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),

    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>('logLevel') ?? 'info',
          autoLogging: true,
          redact: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.sharedSecret'],
        },
      }),
    }),

    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host') ?? 'localhost',
          port: config.get<number>('redis.port') ?? 6379,
          password: config.get<string>('redis.password'),
        },
        prefix: config.get<string>('bullmq.prefix') ?? 'kixima-int',
      }),
    }),

    // Infra global
    PrismaModule,
    CryptoModule,
    AuditModule,

    // Domínio
    ProducersModule,
    AdaptersModule,
    RetryModule,
    WebhooksModule,
    SyncModule,
    ConsumersModule,
    MonitoringModule,
  ],
})
export class AppModule {}
