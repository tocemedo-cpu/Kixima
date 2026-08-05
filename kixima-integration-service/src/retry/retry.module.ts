import { Module } from '@nestjs/common';
import { ProducersModule } from '@app/producers/producers.module';
import { DeadLetterService } from './dead-letter.service';

@Module({
  imports: [ProducersModule],
  providers: [DeadLetterService],
  exports: [DeadLetterService],
})
export class RetryModule {}
