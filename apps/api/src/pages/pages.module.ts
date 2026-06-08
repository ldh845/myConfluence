import { Module } from '@nestjs/common';
import { PagesController } from './pages.controller';
import { PagesService } from './pages.service';
import { AttachmentsModule } from '../attachments/attachments.module';
import { ActivitiesModule } from '../activities/activities.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SpacePermissionModule } from '../spaces/space-permission.module';
import { EffectiveAccessModule } from '../spaces/effective-access.module';

@Module({
  // FR-080 — PagesService.remove가 첨부 디스크 정리 시 AttachmentsService를
  // 호출하므로 AttachmentsModule을 import 한다.
  // FR-131 (Cycle 24) — 페이지 mutation에 activity log를 기록.
  // FR-001 (Cycle 27c) — JwtAuthGuard 적용. AuthModule이 JwtStrategy를 등록.
  // Cycle 59 — 발행 시 멘션된 사용자에게 알림 트리거 (notifyMentions).
  imports: [
    AttachmentsModule,
    ActivitiesModule,
    AuthModule,
    NotificationsModule,
    // Cycle 74-A — 페이지 read/edit 시 스페이스 권한 판정.
    SpacePermissionModule,
    // Cycle L9 — 페이지 접근 권한 역산(effective-access).
    EffectiveAccessModule,
  ],
  controllers: [PagesController],
  providers: [PagesService],
})
export class PagesModule {}
