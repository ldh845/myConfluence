import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthUser } from '../auth/auth.service';
import { AdminService } from './admin.service';
import { UpdateConfigDto } from './dto/update-config.dto';
import { SetLocalPasswordDto } from './dto/set-local-password.dto';
import { CreateLocalUserDto } from './dto/create-local-user.dto';
import { SetActiveDto } from './dto/set-active.dto';

// Cycle 48 — 관리자 전용 라우트. ADMIN role 만 접근 가능.
//   GET  /admin/config   — 시스템 설정 조회 (AppConfig singleton)
//   PUT  /admin/config   — 시스템 설정 부분 갱신
//   GET  /admin/users    — 사용자 목록 (Keycloak claim 캐시 포함)
//
// Keycloak 이 source 인 영역(계정 CRUD·역할 변경)은 여기 없음 — Keycloak Admin
// 콘솔에서 수행.
//
// Cycle L1 (feature/ldh) — 하이브리드 인증.
//   PATCH /admin/users/:id/local-password — 대상 사용자 로컬 비밀번호 설정/초기화
// Cycle L2 (feature/ldh) — 로컬 계정 관리.
//   POST  /admin/users           — 로컬 전용 계정 생성
//   PATCH /admin/users/:id/active — 계정 활성/비활성 토글(자기 자신 비활성화 금지)

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('config')
  getConfig() {
    return this.admin.getConfig();
  }

  @Put('config')
  updateConfig(@Body() dto: UpdateConfigDto) {
    return this.admin.updateConfig(dto);
  }

  @Get('users')
  listUsers() {
    return this.admin.listUsers();
  }

  @Post('users')
  createLocalUser(@Body() dto: CreateLocalUserDto) {
    return this.admin.createLocalUser(dto);
  }

  @Patch('users/:id/active')
  setActive(
    @Param('id') id: string,
    @Body() dto: SetActiveDto,
    @Req() req: Request,
  ) {
    const requester = (req as Request & { user?: AuthUser }).user!;
    return this.admin.setActive(id, dto.isActive, requester.id);
  }

  @Patch('users/:id/local-password')
  setLocalPassword(
    @Param('id') id: string,
    @Body() dto: SetLocalPasswordDto,
  ) {
    return this.admin.setLocalPassword(id, dto.password);
  }
}
