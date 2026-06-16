import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Observable } from 'rxjs';

// Cycle L-API-3 (feature/ldh) — API 토큰 스코프 enforcement(공통, 라우트 무변경).
//   인터셉터는 모든 가드 이후에 실행되므로, 토큰 인증(ApiTokenStrategy)이 req 에 심어둔
//   authVia/tokenScope 를 신뢰하고 판정할 수 있다.
//   판정: authVia === 'api-token' && scope === 'READ' && 메서드가 GET/HEAD 가 아니면 403.
//   - 쿠키 인증(authVia 없음/'cookie')은 무조건 통과 — 스코프 영향 0.
//   - READ_WRITE 토큰도 무조건 통과(쓰기 권한은 결국 주인 권한 가드가 최종 판정).
//   - 쓰기 차단은 401 이 아니라 403 → 전역 401 자동 로그아웃에 걸리지 않는다.
//   APP_INTERCEPTOR 로 전역 등록(AuthModule). 인증 안 한 public 라우트엔 authVia 가
//   없어 자연히 no-op.
const READ_ALLOWED_METHODS = new Set(['GET', 'HEAD']);

@Injectable()
export class ApiTokenScopeInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    // HTTP 컨텍스트가 아니면(예: ws) 관여하지 않는다.
    if (ctx.getType() !== 'http') return next.handle();

    const req = ctx.switchToHttp().getRequest<
      Request & { authVia?: string; tokenScope?: string }
    >();

    if (
      req.authVia === 'api-token' &&
      req.tokenScope === 'READ' &&
      !READ_ALLOWED_METHODS.has(req.method.toUpperCase())
    ) {
      throw new ForbiddenException({
        error: 'insufficient token scope',
        message:
          '이 API 토큰은 읽기 전용(READ)입니다. 쓰기 작업은 READ_WRITE 토큰이 필요합니다.',
      });
    }

    return next.handle();
  }
}
