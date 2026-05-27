import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

// Cycle 59 — 알림 모듈.
//   - 모든 라우트 JwtAuthGuard (AuthModule import)
//   - NotificationsService export — PagesModule 가 발행 시 호출(59-3)
@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
