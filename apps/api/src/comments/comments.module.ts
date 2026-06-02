import { Module } from '@nestjs/common';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { ActivitiesModule } from '../activities/activities.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  // FR-131 (Cycle 24) — 댓글 생성 시 activity log.
  // FR-001 (Cycle 27d) — JwtAuthGuard 등록.
  // Cycle 60 — 댓글/답글 알림 트리거 (notifyOne).
  imports: [ActivitiesModule, AuthModule, NotificationsModule],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
