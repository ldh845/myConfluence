import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WatchesController } from './watches.controller';
import { WatchesService } from './watches.service';

// Cycle 53 — '지켜보기' 모듈. SavesModule 과 동일 패턴.
@Module({
  imports: [AuthModule],
  controllers: [WatchesController],
  providers: [WatchesService],
})
export class WatchesModule {}
