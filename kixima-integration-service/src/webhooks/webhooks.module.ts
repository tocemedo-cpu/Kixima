import { Module } from '@nestjs/common';
import { CredentialsModule } from '@app/credentials/credentials.module';
import { WebhookController } from './webhook.controller';
import { WebhookProducer } from './webhook.producer';

@Module({
  imports: [CredentialsModule],
  controllers: [WebhookController],
  providers: [WebhookProducer],
  exports: [WebhookProducer],
})
export class WebhooksModule {}
