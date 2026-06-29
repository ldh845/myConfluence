import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

// K8s oauth2-proxy Ingress annotation 기반 인증.
// oauth2-proxy가 인증 후 주입하는 헤더를 읽어:
//   1. docspace_session 쿠키가 없으면 → 사용자 findOrCreate + 쿠키 발급
//   2. docspace_session 쿠키가 있으면 → 패스 (기존 jwt.strategy가 처리)
//
// 헤더 (values.yaml auth-response-headers 기준):
//   X-Auth-Request-User                 — 사용자 ID (Keycloak sub)
//   X-Auth-Request-Preferred-Username   — 사용자명
//   X-Auth-Request-User-Group           — 그룹 (쉼표 구분)
//   Authorization                       — Bearer 액세스 토큰

@Injectable()
export class Oauth2ProxyMiddleware implements NestMiddleware {
  private readonly logger = new Logger(Oauth2ProxyMiddleware.name);
  private readonly cookieName: string;
  private readonly cookieSecure: boolean;
  private readonly cookieSameSite: 'lax' | 'strict' | 'none';
  private readonly maxAgeMs = 7 * 24 * 60 * 60 * 1000;

  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {
    this.cookieName = config.get<string>('COOKIE_NAME', 'docspace_session');
    this.cookieSecure = config.get<string>('COOKIE_SECURE') === 'true';
    const ss = (config.get<string>('COOKIE_SAMESITE') ?? 'lax').toLowerCase();
    this.cookieSameSite =
      ss === 'strict' ? 'strict' : ss === 'none' ? 'none' : 'lax';
  }

  async use(req: any, res: any, next: () => void): Promise<void> {
    // 이미 docspace_session 쿠키가 있으면 미들웨어 패스
    const cookies = req.cookies as Record<string, string> | undefined;
    const existingToken = cookies?.[this.cookieName];
    if (existingToken) {
      next();
      return;
    }

    // oauth2-proxy 헤더 확인
    const userId = req.headers['x-auth-request-user'] as string | undefined;
    const username = req.headers[
      'x-auth-request-preferred-username'
    ] as string | undefined;

    if (!userId || !username) {
      // 헤더 없음 = oauth2-proxy 미적용 상태. 기존 흐름 그대로.
      next();
      return;
    }

    try {
      // findOrCreateOidcUser 재사용 — keycloakId(sub)로 사용자 매핑
      const user = await this.auth.findOrCreateOidcUser({
        sub: userId,
        username,
        name: username,
      });

      // docspace_session 쿠키 발급
      const token = this.auth.issueToken(user);
      res.cookie(this.cookieName, token, {
        httpOnly: true,
        secure: this.cookieSecure,
        sameSite: this.cookieSameSite,
        path: '/',
        maxAge: this.maxAgeMs,
      });

      this.logger.log(
        `oauth2-proxy auto-login: user=${user.username} (${user.id})`,
      );
    } catch (err) {
      // 계정 비활성 등 — 쿠키 발급 실패해도 요청은 계속 진행
      this.logger.warn(
        `oauth2-proxy auto-login failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    next();
  }
}
