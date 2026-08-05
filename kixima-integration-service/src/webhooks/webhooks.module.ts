import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookProducer } from './webhook.producer';

@Module({
  controllers: [WebhookController],
  providers: [WebhookProducer],
  exports: [WebhookProducer],
})
export class WebhooksModule {}
