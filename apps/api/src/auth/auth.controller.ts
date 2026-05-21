import {
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthUser } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

// Cycle 43(2/2) — 자체 인증(POST /auth/signup, /auth/login) 제거.
// 로그인은 Keycloak OIDC(OidcController: /auth/oidc/login·/callback) 단일 경로.
// 여기엔 세션 종료와 현재 사용자 조회만 남는다.
//  POST /auth/logout  — docspace_session 쿠키 클리어 (로컬 세션 종료)
//  GET  /auth/me      — 현재 사용자 (cookie 필수, JwtAuthGuard)
//
// 비고: Keycloak SSO 단일 로그아웃(end_session_endpoint)은 id_token 보관이
// 필요한 별도 설계 — 남은 일로 미룸. 지금은 로컬 쿠키만 클리어.

@Controller('auth')
export class AuthController {
  private readonly cookieName: string;

  constructor(private readonly config: ConfigService) {
    this.cookieName = config.get<string>('COOKIE_NAME', 'docspace_session');
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(this.cookieName, { path: '/' });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request): { user: AuthUser } {
    const user = (req as Request & { user?: AuthUser }).user;
    return { user: user as AuthUser };
  }
}
