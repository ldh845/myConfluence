import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SavesController } from './saves.controller';
import { SavesService } from './saves.service';

// Cycle 53 — '나중을 위해 저장' 모듈.
// 모든 라우트가 JwtAuthGuard 를 사용하므로 AuthModule 의존.
@Module({
  imports: [AuthModule],
  controllers: [SavesController],
  providers: [SavesService],
})
export class SavesModule {}
