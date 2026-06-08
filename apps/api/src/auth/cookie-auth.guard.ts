import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Cycle L-API-1 (feature/ldh) — 쿠키 전용 가드(jwt 단일 전략).
//   하이브리드 가드(JwtAuthGuard)가 API 토큰도 받아들이게 확장되면서, **사람 세션(쿠키)
//   만** 허용해야 하는 라우트를 위해 분리한다. 토큰 관리 엔드포인트(/auth/tokens,
//   /admin/api-tokens)에 적용 — 유출된 토큰이 스스로 새 토큰을 발급/폐기하지 못하게
//   막는다(토큰 관리는 브라우저/콘솔의 사람 작업).
@Injectable()
export class CookieAuthGuard extends AuthGuard('jwt') {}
