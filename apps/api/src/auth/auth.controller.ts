import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import { AuthService, AuthUser } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UpdatePrefsDto } from './dto/update-prefs.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

// Cycle 43 — 자체 인증(signup/login) 제거. Cycle 43 followup — 로그아웃(SLO)은
// OidcController(GET /auth/oidc/logout)로 이동(Keycloak end_session 의존).
// 여기엔 현재 사용자 조회 + Cycle 49 부터 사용자 환경설정 갱신.
//  GET   /auth/me        — 현재 사용자 (cookie 필수, JwtAuthGuard)
//  PATCH /auth/me/prefs  — 사용자 환경설정 부분 갱신 (Cycle 49)
//
// Cycle L1 (feature/ldh) — 하이브리드 인증(SSO + 로컬). LOCAL_LOGIN_ENABLED 플래그가
// 켜진 경우에만 로컬 로그인 경로를 노출. OIDC 는 무관하게 그대로 동작.
//  GET   /auth/local-login-enabled — 플래그 노출(프론트가 폼 표시 여부 결정, public)
//  POST  /auth/login               — username/password 로컬 로그인 → docspace_session 쿠키
// Cycle L2 followup (feature/ldh) — 전역 401 추방용 경량 세션 정리.
//  POST  /auth/clear-session       — 세션 쿠키만 제거(인증 불요, SLO 미경유)

@Controller('auth')
export class AuthController {
  // OIDC 콜백(OidcController)과 동일한 세션 쿠키 옵션을 재사용해 두 경로가 같은
  // docspace_session 쿠키를 발급하도록 한다.
  private readonly cookieName: string;
  private readonly cookieSecure: boolean;
  private readonly cookieSameSite: 'lax' | 'strict' | 'none';
  private readonly maxAgeMs = 7 * 24 * 60 * 60 * 1000;
  private readonly localLoginEnabled: boolean;

  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {
    this.cookieName = config.get<string>('COOKIE_NAME', 'docspace_session');
    this.cookieSecure = config.get<string>('COOKIE_SECURE') === 'true';
    const ss = (config.get<string>('COOKIE_SAMESITE') ?? 'lax').toLowerCase();
    this.cookieSameSite =
      ss === 'strict' ? 'strict' : ss === 'none' ? 'none' : 'lax';
    this.localLoginEnabled =
      config.get<string>('LOCAL_LOGIN_ENABLED') === 'true';
  }

  private sessionCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.cookieSecure,
      sameSite: this.cookieSameSite,
      path: '/',
      maxAge: this.maxAgeMs,
    };
  }

  // 프론트 로그인 화면이 ID/PW 폼을 띄울지 결정하기 위한 public 플래그.
  @Get('local-login-enabled')
  localLoginConfig(): { enabled: boolean } {
    return { enabled: this.localLoginEnabled };
  }

  // Cycle L2 followup (feature/ldh) — 전역 401 추방 시 호출하는 경량 세션 정리.
  // 쿠키가 httpOnly 라 클라이언트가 직접 지울 수 없으므로 서버 엔드포인트가 필요하다.
  // 비활성/만료 세션이 대상이라 Keycloak end_session(SLO)은 타지 않는다 — 비활성
  // 사용자는 Keycloak 왕복이 실패할 수 있어 로컬 쿠키 정리만 한다(인증 가드 없음).
  // 완전 로그아웃(SLO)은 별도 경로(GET /auth/oidc/logout)가 담당.
  @Post('clear-session')
  clearSession(@Res({ passthrough: true }) res: Response): { ok: true } {
    res.clearCookie(this.cookieName, { path: '/' });
    // OIDC id_token 보관 쿠키(있으면)도 함께 정리.
    res.clearCookie('oidc_id_token', { path: '/' });
    return { ok: true };
  }

  // 로컬 로그인. 플래그가 꺼져 있으면 403 — 경로 자체를 막는다.
  // 성공 시 OIDC 콜백과 동일한 docspace_session 쿠키를 심고 사용자 정보를 반환.
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: AuthUser }> {
    if (!this.localLoginEnabled) {
      throw new ForbiddenException({ error: 'local login disabled' });
    }
    const { user, token } = await this.auth.localLogin(
      dto.username,
      dto.password,
    );
    res.cookie(this.cookieName, token, this.sessionCookieOptions());
    return { user };
  }

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

  // Cycle L3 (feature/ldh) — 셀프 비밀번호 변경. 본인 세션(JwtAuthGuard) 필수.
  // SSO 전용 400 / 현재 비번 불일치 401 / 새 비번 정책 위반 400 은 서비스가 던진다.
  @Patch('me/password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Req() req: Request,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ ok: true }> {
    const user = (req as Request & { user?: AuthUser }).user!;
    return this.auth.changeMyPassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
    );
  }
}
