import { Module } from '@nestjs/common';
import { PagesController } from './pages.controller';
import { PagesService } from './pages.service';
import { AttachmentsModule } from '../attachments/attachments.module';
import { ActivitiesModule } from '../activities/activities.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  // FR-080 — PagesService.remove가 첨부 디스크 정리 시 AttachmentsService를
  // 호출하므로 AttachmentsModule을 import 한다.
  // FR-131 (Cycle 24) — 페이지 mutation에 activity log를 기록.
  // FR-001 (Cycle 27c) — JwtAuthGuard 적용. AuthModule이 JwtStrategy를 등록.
  imports: [AttachmentsModule, ActivitiesModule, AuthModule],
  controllers: [PagesController],
  providers: [PagesService],
})
export class PagesModule {}
