import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { AuthService, AuthUser } from './auth.service';

// FR-001 (Cycle 27a) — JWT 토큰을 httpOnly cookie에서 추출.
// XSS 방어 우선이라 Authorization 헤더 fallback은 의도적으로 없음.

type JwtPayload = { sub: string; username: string; role: string };

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    const cookieName = config.get<string>('COOKIE_NAME', 'docspace_session');
    super({
      jwtFromRequest: (req: Request) => {
        const cookies = (req as Request & { cookies?: Record<string, string> })
          .cookies;
        return cookies?.[cookieName] ?? null;
      },
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') ?? 'dev-fallback',
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.auth.findById(payload.sub);
    if (!user) throw new UnauthorizedException();
    // Cycle L2 (feature/ldh) — 비활성 계정은 유효한 JWT 가 남아 있어도 즉시 차단.
    // 7일 만료 토큰이 비활성화 직후에도 통과하는 구멍을 막는다.
    if (!user.isActive) throw new UnauthorizedException();
    return user;
  }
}
