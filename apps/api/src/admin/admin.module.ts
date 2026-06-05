import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';

// Cycle 48 — Admin 모듈. JwtAuthGuard/RolesGuard 가 jwt.strategy 를 쓰므로
// AuthModule import.
// Cycle L6 (feature/ldh) — 그룹 관리(GroupsController/Service) 추가.
@Module({
  imports: [AuthModule],
  controllers: [AdminController, GroupsController],
  providers: [AdminService, GroupsService],
})
export class AdminModule {}
