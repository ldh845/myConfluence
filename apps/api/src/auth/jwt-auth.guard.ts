import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// FR-001 (Cycle 27a) — JWT cookie 기반 보호. 명시적 @UseGuards(JwtAuthGuard).
// Cycle L-API-1 (feature/ldh) — 하이브리드 인증으로 확장. 멀티 전략 ['jwt','api-token']:
//   passport 가 순서대로 시도 → 쿠키가 있으면 jwt 가, Authorization: Bearer 만 있으면
//   api-token 이 인증. 둘 중 하나라도 성공하면 통과, 둘 다 실패면 401.
//   토큰 인증 시 req.user 는 쿠키 인증과 동일한 AuthUser 형태 → 기존 RolesGuard /
//   SpacePermissionService(L5~L10)가 라우트 변경 없이 그대로 동작한다.
//   쿠키 전용이어야 하는 라우트(토큰 관리)는 CookieAuthGuard 를 쓴다.
@Injectable()
export class JwtAuthGuard extends AuthGuard(['jwt', 'api-token']) {}
