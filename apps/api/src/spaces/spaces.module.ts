import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SpacesController } from './spaces.controller';
import { SpacesService } from './spaces.service';

@Module({
  // Cycle 32 — GET /spaces(Optional) + /spaces/personal(Jwt) 가드가 JwtStrategy 사용.
  imports: [AuthModule],
  controllers: [SpacesController],
  providers: [SpacesService],
})
export class SpacesModule {}
