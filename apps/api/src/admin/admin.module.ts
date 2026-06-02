import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

// Cycle 48 — Admin 모듈. JwtAuthGuard/RolesGuard 가 jwt.strategy 를 쓰므로
// AuthModule import.
@Module({
  imports: [AuthModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
