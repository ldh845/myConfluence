import { Module } from '@nestjs/common';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';
import { AuthModule } from '../auth/auth.module';
import { SpacePermissionModule } from '../spaces/space-permission.module';

@Module({
  // Cycle L5 (feature/ldh) — 공개 활동 피드 가시성 필터.
  //   AuthModule: OptionalJwtAuthGuard. SpacePermissionModule: spaceVisibilityWhere.
  imports: [AuthModule, SpacePermissionModule],
  controllers: [ActivitiesController],
  providers: [ActivitiesService],
  exports: [ActivitiesService],
})
export class ActivitiesModule {}
