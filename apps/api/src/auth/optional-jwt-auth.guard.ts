import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Cycle 32 — 선택적 JWT 가드. 토큰이 없거나 무효해도 통과시킨다.
// req.user 는 인증됐을 때만 채워지고, 아니면 undefined.
// GET /spaces 처럼 공개이지만 인증 시 추가 데이터를 보여주는 라우트용.
// Cycle L-API-1 (feature/ldh) — 멀티 전략 ['jwt','api-token'] 으로 확장.
//   세 경우 모두 종전 의미 유지: 쿠키 → jwt 인증, Bearer 토큰 → api-token 인증,
//   둘 다 없음 → 익명(handleRequest 가 null 반환). 인증 실패도 익명으로 흡수한다.
// Cycle L-AFS (feature/ldh) — oauth2-proxy 무상태 전략 추가.
//   헤더 있으면 oauth2-proxy 인증, 없으면 fail → 다음 전략 시도.
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard(['oauth2-proxy', 'jwt', 'api-token']) {
  handleRequest<TUser = unknown>(_err: unknown, user: TUser): TUser {
    return (user ?? null) as TUser;
  }
}
