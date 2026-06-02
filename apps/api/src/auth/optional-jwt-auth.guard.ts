import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Cycle 32 — 선택적 JWT 가드. 토큰이 없거나 무효해도 통과시킨다.
// req.user 는 인증됐을 때만 채워지고, 아니면 undefined.
// GET /spaces 처럼 공개이지만 인증 시 추가 데이터를 보여주는 라우트용.
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(_err: unknown, user: TUser): TUser {
    return (user ?? null) as TUser;
  }
}
