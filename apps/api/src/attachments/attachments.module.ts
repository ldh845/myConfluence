import { Module } from '@nestjs/common';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { AuthModule } from '../auth/auth.module';
import { SpacePermissionModule } from '../spaces/space-permission.module';

@Module({
  // Cycle L5 (feature/ldh) — 첨부 라우트에 인증/권한 가드 추가.
  //   AuthModule: JwtAuthGuard/OptionalJwtAuthGuard(JwtStrategy 등록).
  //   SpacePermissionModule: assertCanViewPage/assertCanEditPage.
  imports: [AuthModule, SpacePermissionModule],
  controllers: [AttachmentsController],
  providers: [AttachmentsService],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
