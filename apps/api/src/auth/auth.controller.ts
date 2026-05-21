import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthUser } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

// Cycle 43 — 자체 인증(signup/login) 제거. Cycle 43 followup — 로그아웃(SLO)은
// OidcController(GET /auth/oidc/logout)로 이동(Keycloak end_session 의존).
// 여기엔 현재 사용자 조회만 남는다.
//  GET /auth/me — 현재 사용자 (cookie 필수, JwtAuthGuard)

@Controller('auth')
export class AuthController {
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request): { user: AuthUser } {
    const user = (req as Request & { user?: AuthUser }).user;
    return { user: user as AuthUser };
  }
}
