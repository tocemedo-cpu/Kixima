import { Module } from '@nestjs/common';
import { AdaptersModule } from '@app/adapters/adapters.module';
import { CredentialsService } from './credentials.service';
import { CredentialsController } from './credentials.controller';
import { AdminTokenGuard } from './admin-token.guard';

@Module({
  imports: [AdaptersModule],
  controllers: [CredentialsController],
  providers: [CredentialsService, AdminTokenGuard],
  exports: [CredentialsService],
})
export class CredentialsModule {}
