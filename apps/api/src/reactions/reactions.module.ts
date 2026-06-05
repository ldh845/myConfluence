import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ReactionsController } from './reactions.controller';
import { ReactionsService } from './reactions.service';
import { SpacePermissionModule } from '../spaces/space-permission.module';

@Module({
  // FR-001 (Cycle 27e) — toggle 라우트가 JwtAuthGuard를 사용.
  // Cycle L5 — 리액션 목록 읽기 권한 판정(assertCanViewPage). PrismaService 는 @Global.
  imports: [AuthModule, SpacePermissionModule],
  controllers: [ReactionsController],
  providers: [ReactionsService],
})
export class ReactionsModule {}
