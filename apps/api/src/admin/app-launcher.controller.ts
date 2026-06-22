import { Controller, Get, UseGuards } from '@nestjs/common';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { AdminService } from './admin.service';

// Cycle L1 (feature/ldh) — 로그인한 사용자는 관리자 설정한 전사 바로가기 목록만 본다.
// 관리자 설정은 /admin 의 일반 설정 탭에서 별도 처리한다.
@Controller('admin')
@UseGuards(OptionalJwtAuthGuard)
export class AppLauncherController {
  constructor(private readonly admin: AdminService) {}

  @Get('launchers')
  getLaunchers() {
    return this.admin.getLaunchers();
  }
}