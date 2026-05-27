import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, AuthUser } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UpdatePrefsDto } from './dto/update-prefs.dto';

// Cycle 43 — 자체 인증(signup/login) 제거. Cycle 43 followup — 로그아웃(SLO)은
// OidcController(GET /auth/oidc/logout)로 이동(Keycloak end_session 의존).
// 여기엔 현재 사용자 조회 + Cycle 49 부터 사용자 환경설정 갱신.
//  GET   /auth/me        — 현재 사용자 (cookie 필수, JwtAuthGuard)
//  PATCH /auth/me/prefs  — 사용자 환경설정 부분 갱신 (Cycle 49)

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request): { user: AuthUser } {
    const user = (req as Request & { user?: AuthUser }).user;
    return { user: user as AuthUser };
  }

  @Patch('me/prefs')
  @UseGuards(JwtAuthGuard)
  async updatePrefs(
    @Req() req: Request,
    @Body() dto: UpdatePrefsDto,
  ): Promise<{ user: AuthUser }> {
    const user = (req as Request & { user?: AuthUser }).user!;
    const updated = await this.auth.updateMyPrefs(user.id, dto);
    return { user: updated };
  }
}
