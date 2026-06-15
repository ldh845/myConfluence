import { Module } from '@nestjs/common';
import { AttachmentsModule } from '../attachments/attachments.module';
import { AuthModule } from '../auth/auth.module';
import { PageSharesController } from './page-shares.controller';
import { PageSharesService } from './page-shares.service';
import { SpacePermissionModule } from '../spaces/space-permission.module';

@Module({
  // FR-001 (Cycle 27d) — share 발급/rotate/revoke에 JwtAuthGuard 사용.
  // Cycle L5-2 — share 발급/회전/취소에 페이지 편집 권한 판정(assertCanEditPage).
  imports: [AttachmentsModule, AuthModule, SpacePermissionModule],
  controllers: [PageSharesController],
  providers: [PageSharesService],
})
export class PageSharesModule {}
