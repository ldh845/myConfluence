import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_KEY } from './roles.decorator';

// Cycle 48 — Role 가드. @Roles('ADMIN') 메타데이터와 함께 사용.
// JwtAuthGuard 뒤에 배치 — req.user 가 채워져 있어야 한다.
// payload.role 은 OIDC callback 에서 Keycloak realm role 로 매 로그인마다
// 동기화된다(auth.service.findOrCreateOidcUser). 따라서 Keycloak 에서 admin
// 회수 → 그 사용자 다음 로그인부터 ADMIN 박탈.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(
      ROLES_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const user = (req as Request & { user?: { role?: string } }).user;
    if (!user?.role || !required.includes(user.role)) {
      throw new ForbiddenException({ error: 'insufficient role' });
    }
    return true;
  }
}
