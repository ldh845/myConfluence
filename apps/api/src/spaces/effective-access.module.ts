import { Module } from '@nestjs/common';
import { SpacePermissionModule } from './space-permission.module';
import { EffectiveAccessService } from './effective-access.service';

// Cycle L9 (feature/ldh) — 접근 권한 역산 서비스. SpacesController·PagesController 가
//   각각 effective-access 엔드포인트에서 사용. PrismaModule 은 @Global.
@Module({
  imports: [SpacePermissionModule],
  providers: [EffectiveAccessService],
  exports: [EffectiveAccessService],
})
export class EffectiveAccessModule {}
