import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ActivitiesModule } from '../activities/activities.module';
import { SpacesController } from './spaces.controller';
import { SpacesService } from './spaces.service';

@Module({
  // Cycle 32 — GET /spaces(Optional) + /spaces/personal(Jwt) 가드가 JwtStrategy 사용.
  // Cycle 33 — 공간 생성 시 홈 페이지 activity log.
  imports: [AuthModule, ActivitiesModule],
  controllers: [SpacesController],
  providers: [SpacesService],
})
export class SpacesModule {}
