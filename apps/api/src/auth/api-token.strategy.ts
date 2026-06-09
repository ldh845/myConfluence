import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-strategy';
import type { Request } from 'express';
import { ApiTokenService } from './api-token.service';

// Cycle L-API-1 (feature/ldh) — Bearer API 토큰 Passport 전략('api-token').
//   jwt(쿠키) 전략과 멀티 전략으로 결합된다: AuthGuard(['jwt','api-token']).
//   passport 는 배열 순서대로 전략을 시도하고 첫 success 가 이긴다 — 쿠키가 있으면
//   jwt 가, Authorization: Bearer 만 있으면 이 전략이 인증한다.
//   실패는 throw 가 아니라 this.fail() — 멀티 전략에서 다음 전략/익명 처리로 자연 위임.
//   성공 시 this.success(user) 의 user 는 쿠키 인증과 동일한 AuthUser 형태이므로
//   기존 RolesGuard/SpacePermissionService(L5~L10)가 그대로 동작한다.
@Injectable()
export class ApiTokenStrategy extends PassportStrategy(Strategy, 'api-token') {
  constructor(private readonly apiTokens: ApiTokenService) {
    super();
  }

  // passport-strategy 진입점. Authorization 헤더에서 Bearer 토큰을 추출·검증.
  async authenticate(req: Request): Promise<void> {
    const header = req.headers['authorization'];
    if (!header || typeof header !== 'string' || !header.startsWith('Bearer ')) {
      // 토큰 없음 → 이 전략은 실패시키고 passport 가 다음 전략(jwt)/익명으로.
      this.fail(401);
      return;
    }
    const raw = header.slice('Bearer '.length).trim();
    try {
      const result = await this.apiTokens.authenticateToken(raw);
      if (!result) {
        this.fail(401);
        return;
      }
      // Cycle L-API-3 — 인증 경로/스코프를 req 에 표시 → ApiTokenScopeInterceptor 가
      // READ 토큰의 쓰기(POST/PUT/PATCH/DELETE)를 403 으로 막는다(라우트 무변경).
      const marked = req as Request & {
        authVia?: string;
        tokenScope?: string;
      };
      marked.authVia = 'api-token';
      marked.tokenScope = result.scope;
      this.success(result.user);
    } catch (err) {
      // 인증 실패가 아닌 내부 오류(DB 등)는 error 로 — 500 으로 표면화.
      this.error(err instanceof Error ? err : new Error(String(err)));
    }
  }

  // PassportStrategy 믹스인이 abstract 로 요구하지만, authenticate 를 직접 구현해
  // success/fail 을 처리하므로 호출되지 않는다(데드코드, 타입 충족용).
  validate(): void {
    /* unused */
  }
}
