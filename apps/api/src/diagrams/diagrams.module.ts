import { Module } from '@nestjs/common';
import { DiagramsController } from './diagrams.controller';
import { DiagramsService } from './diagrams.service';
import { AuthModule } from '../auth/auth.module';
import { SpacePermissionModule } from '../spaces/space-permission.module';

@Module({
  // Cycle L5 (feature/ldh) — 다이어그램 라우트에 인증/권한 가드 추가.
  imports: [AuthModule, SpacePermissionModule],
  controllers: [DiagramsController],
  providers: [DiagramsService],
})
export class DiagramsModule {}
