import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { GroupsDirectoryController } from './groups-directory.controller';
import { AdminApiTokensController } from './admin-api-tokens.controller';

// Cycle 48 — Admin 모듈. JwtAuthGuard/RolesGuard 가 jwt.strategy 를 쓰므로
// AuthModule import.
// Cycle L6 (feature/ldh) — 그룹 관리(GroupsController/Service) 추가.
// Cycle L7 (feature/ldh) — 그룹 선택 디렉터리(GroupsDirectoryController, 인증) 추가.
// Cycle L-API-1 (feature/ldh) — 관리자 API 토큰 관리(AdminApiTokensController) 추가.
//   ApiTokenService 는 AuthModule 이 export → 여기서 import 만으로 주입 가능.
@Module({
  imports: [AuthModule],
  controllers: [
    AdminController,
    GroupsController,
    GroupsDirectoryController,
    AdminApiTokensController,
  ],
  providers: [AdminService, GroupsService],
})
export class AdminModule {}
