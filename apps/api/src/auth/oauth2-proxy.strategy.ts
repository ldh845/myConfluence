import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-strategy';
import type { Request } from 'express';
import { AuthService, AuthUser } from './auth.service';

// K8s oauth2-proxy 무상태 인증 전략('oauth2-proxy').
//   oauth2-proxy 가 Ingress annotation 으로 주입한 헤더를 매 요청마다 검증.
//   자체 JWT/세션 발급 없이 헤더를 신뢰(stateless) — JWT_SECRET 의존 제거.
//
//   동작 (방식 B — 최초 1회만 무거운 작업):
//   1. X-Auth-Request-User / X-Auth-Request-Preferred-Username 헤더 추출
//   2. keycloakId(sub)로 기존 사용자 조회 (findByKeycloakId — 경량)
//   3. 없으면 findOrCreateOidcUser (최초 1회만 DB 쓰기 + 그룹 동기화)
//   4. 비활성 계정 차단
//   5. AuthUser 반환 → 기존 RolesGuard / SpacePermissionService 그대로 동작
//
//   멀티 전략 AuthGuard(['oauth2-proxy', 'jwt', 'api-token']) 에서
//   헤더가 없으면 this.fail() → 다음 strategy(jwt)로 자연 위임.
//   AUTH_MODE 분기 불필요 — 헤더 없으면 항상 fail 이므로 로컬 개발 영향 없음.

@Injectable()
export class Oauth2ProxyStrategy extends PassportStrategy(
  Strategy,
  'oauth2-proxy',
) {
  constructor(private readonly auth: AuthService) {
    super();
  }

  async authenticate(req: Request): Promise<void> {
    const sub = req.headers['x-auth-request-user'] as string | undefined;
    const username = req.headers['x-auth-request-preferred-username'] as
      | string
      | undefined;

    if (!sub || !username) {
      // 헤더 없음 = oauth2-proxy 미적용 상태 → 다음 strategy 로 위임.
      this.fail(401);
      return;
    }

    try {
      // 1. keycloakId(sub)로 경량 조회 (매 요청).
      let user: AuthUser | null = await this.auth.findByKeycloakId(sub);

      // 2. 없으면 최초 1회만 findOrCreateOidcUser (DB 쓰기 + 그룹 동기화).
      if (!user) {
        user = await this.auth.findOrCreateOidcUser({
          sub,
          username,
          name: username,
        });
      }

      // 3. 비활성 계정 차단.
      if (!user.isActive) {
        this.fail(401);
        return;
      }

      this.success(user);
    } catch (err) {
      // 인증 실패가 아닌 내부 오류(DB 등)는 error 로 — 500 표면화.
      this.error(err instanceof Error ? err : new Error(String(err)));
    }
  }

  // PassportStrategy 믹스인이 abstract 로 요구하지만, authenticate 를 직접 구현해
  // success/fail 을 처리하므로 호출되지 않는다(데드코드, 타입 충족용).
  validate(): void {
    /* unused */
  }
}
