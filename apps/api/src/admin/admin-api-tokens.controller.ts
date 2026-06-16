import {
  Controller,
  Delete,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CookieAuthGuard } from '../auth/cookie-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import {
  AdminApiTokenView,
  ApiTokenService,
} from '../auth/api-token.service';

// Cycle L-API-1 (feature/ldh) — 관리자 전용 API 토큰 관리.
//   CookieAuthGuard(쿠키 전용) + RolesGuard + @Roles('ADMIN').
//   토큰 관리는 사람(콘솔) 작업이라 쿠키 세션만 허용한다.
//   GET    /admin/api-tokens      전체 토큰 목록(소유자 동반, 평문 없음)
//   DELETE /admin/api-tokens/:id  강제 폐기(누구의 토큰이든)
@Controller('admin/api-tokens')
@UseGuards(CookieAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminApiTokensController {
  constructor(private readonly apiTokens: ApiTokenService) {}

  @Get()
  async list(): Promise<{ tokens: AdminApiTokenView[] }> {
    const tokens = await this.apiTokens.listAll();
    return { tokens };
  }

  @Delete(':id')
  async revoke(@Param('id') id: string): Promise<{ ok: true }> {
    return this.apiTokens.revokeAny(id);
  }
}
