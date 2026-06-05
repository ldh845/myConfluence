import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WatchesController } from './watches.controller';
import { WatchesService } from './watches.service';
import { SpacePermissionModule } from '../spaces/space-permission.module';

// Cycle 53 — '지켜보기' 모듈. SavesModule 과 동일 패턴.
// Cycle L5-2 — watch 등록에 페이지 읽기 권한 판정(assertCanViewPage).
@Module({
  imports: [AuthModule, SpacePermissionModule],
  controllers: [WatchesController],
  providers: [WatchesService],
})
export class WatchesModule {}
