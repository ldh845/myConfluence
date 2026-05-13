import { Module } from '@nestjs/common';
import { AttachmentsModule } from '../attachments/attachments.module';
import { AuthModule } from '../auth/auth.module';
import { PageSharesController } from './page-shares.controller';
import { PageSharesService } from './page-shares.service';

@Module({
  // FR-001 (Cycle 27d) — share 발급/rotate/revoke에 JwtAuthGuard 사용.
  imports: [AttachmentsModule, AuthModule],
  controllers: [PageSharesController],
  providers: [PageSharesService],
})
export class PageSharesModule {}
