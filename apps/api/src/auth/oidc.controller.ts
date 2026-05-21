import { Controller, Get, Logger, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { OidcService } from './oidc.service';

// Cycle 43 — Keycloak OIDC 로그인 라우트(추가만). 기존 자체 인증(/auth/signup,
// /auth/login)과 jwt.strategy/가드는 그대로. callback 끝에서 기존과 동일한
// docspace_session 쿠키(자체 JWT)를 발급해 이후 요청은 jwt.strategy 가 검증.
//
// state/nonce/PKCE 는 /login 과 /callback 사이에 단명 httpOnly 쿠키(oidc_tx)로
// 전달 — 서버 세션 스토어 없이(stateless) 동작. SameSite=Lax 라 Keycloak 에서
// 돌아오는 top-level GET 리다이렉트에 함께 전송된다.

@Controller('auth/oidc')
export class OidcController {
  private readonly logger = new Logger(OidcController.name);
  private readonly cookieName: string;
  private readonly cookieSecure: boolean;
  private readonly cookieSameSite: 'lax' | 'strict' | 'none';
  private readonly maxAgeMs = 7 * 24 * 60 * 60 * 1000;
  private readonly txCookie = 'oidc_tx';
  private readonly postLoginRedirect: string;

  constructor(
    private readonly oidc: OidcService,
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {
    this.cookieName = config.get<string>('COOKIE_NAME', 'docspace_session');
    this.cookieSecure = config.get<string>('COOKIE_SECURE') === 'true';
    const ss = (config.get<string>('COOKIE_SAMESITE') ?? 'lax').toLowerCase();
    this.cookieSameSite =
      ss === 'strict' ? 'strict' : ss === 'none' ? 'none' : 'lax';
    this.postLoginRedirect = config.get<string>(
      'OIDC_POST_LOGIN_REDIRECT',
      '/home',
    );
  }

  @Get('login')
  async login(@Res() res: Response): Promise<void> {
    const { url, state, nonce, codeVerifier } =
      await this.oidc.createAuthRequest();
    res.cookie(this.txCookie, JSON.stringify({ state, nonce, codeVerifier }), {
      httpOnly: true,
      secure: this.cookieSecure,
      sameSite: this.cookieSameSite,
      path: '/',
      maxAge: 10 * 60 * 1000, // 로그인 왕복용 10분
    });
    res.redirect(url);
  }

  @Get('callback')
  async callback(@Req() req: Request, @Res() res: Response): Promise<void> {
    const raw = (req as Request & { cookies?: Record<string, string> }).cookies?.[
      this.txCookie
    ];
    if (!raw) {
      res.status(400).send('OIDC transaction cookie missing or expired');
      return;
    }
    let tx: { state: string; nonce: string; codeVerifier: string };
    try {
      tx = JSON.parse(raw);
    } catch {
      res.status(400).send('OIDC transaction cookie invalid');
      return;
    }
    res.clearCookie(this.txCookie, { path: '/' });

    try {
      const claims = await this.oidc.handleCallback(
        req.query as Record<string, unknown>,
        tx,
      );
      const user = await this.auth.findOrCreateOidcUser(claims);
      const token = this.auth.issueToken(user);
      res.cookie(this.cookieName, token, {
        httpOnly: true,
        secure: this.cookieSecure,
        sameSite: this.cookieSameSite,
        path: '/',
        maxAge: this.maxAgeMs,
      });
      res.redirect(this.postLoginRedirect);
    } catch (err) {
      this.logger.error(
        `OIDC callback failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      res.status(401).send('OIDC login failed');
    }
  }
}
