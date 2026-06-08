import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ActivitiesModule } from '../activities/activities.module';
import { SpacesController } from './spaces.controller';
import { SpacesService } from './spaces.service';
import { SpacePermissionModule } from './space-permission.module';
import { EffectiveAccessModule } from './effective-access.module';

@Module({
  // Cycle 32 — GET /spaces(Optional) + /spaces/personal(Jwt) 가드가 JwtStrategy 사용.
  // Cycle 33 — 공간 생성 시 홈 페이지 activity log.
  // Cycle 74-A — 스페이스 권한 판정.
  // Cycle L9 — 접근 권한 역산(effective-access).
  imports: [AuthModule, ActivitiesModule, SpacePermissionModule, EffectiveAccessModule],
  controllers: [SpacesController],
  providers: [SpacesService],
  // Cycle 49 — OidcModule 이 callback 에서 spacesService.getOrCreatePersonal 호출.
  exports: [SpacesService],
})
export class SpacesModule {}
