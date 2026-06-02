import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ReactionsController } from './reactions.controller';
import { ReactionsService } from './reactions.service';

@Module({
  // FR-001 (Cycle 27e) — toggle 라우트가 JwtAuthGuard를 사용.
  imports: [AuthModule],
  controllers: [ReactionsController],
  providers: [ReactionsService],
})
export class ReactionsModule {}
