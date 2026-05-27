import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

// FR-001 / FR-002 — 사용자 조회 + 자체 JWT(docspace_session) 발급.
// Cycle 43(2/2): 자체 인증(bcrypt signup/login) 제거 → 로그인은 Keycloak OIDC 단일.
//   계정 매핑/생성은 findOrCreateOidcUser 가 담당.
//   JWT payload: { sub, username, role }. 응답에서 passwordHash는 항상 제외.
// Cycle 48: ADMIN 권한 source of truth 를 Keycloak realm role 로 이전.
//   매 로그인마다 Keycloak realm_access.roles 의 'admin' 유무로 User.role 동기화.
//   이메일·emailVerified·lastLoginAt 도 매 로그인마다 캐시 갱신.
//   '첫 사용자 자동 ADMIN' seed 로직 제거 — Keycloak 에서 명시적으로 admin realm role
//   을 부여해야 한다.

export type AuthUser = {
  id: string;
  username: string;
  name: string;
  department: string;
  role: string;
  createdAt: Date;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private sanitize(user: {
    id: string;
    username: string;
    name: string;
    department: string;
    role: string;
    createdAt: Date;
  }): AuthUser {
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      department: user.department,
      role: user.role,
      createdAt: user.createdAt,
    };
  }

  async findById(id: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? this.sanitize(user) : null;
  }

  // Cycle 43 — OIDC(Keycloak) 로그인용. callback 에서 ID 토큰 클레임으로 DocSpace
  // User 를 찾거나 만든다. 매핑: keycloakId(sub) 우선 → 없으면 username 으로 기존
  // 계정 링크 → 그래도 없으면 신규 생성(SSO 전용 → passwordHash=null).
  // Cycle 48 — 매 로그인마다 Keycloak claim 동기화:
  //   - role: realm_access.roles 의 'admin' 유무로 ADMIN vs DEVELOPER 토글
  //   - email / emailVerified / lastLoginAt 캐시 갱신
  async findOrCreateOidcUser(claims: {
    sub: string;
    username: string;
    email?: string;
    emailVerified?: boolean;
    name?: string;
    realmRoles?: string[];
  }): Promise<AuthUser> {
    // Prisma Role enum 과 호환되도록 명시 narrow.
    const role: 'ADMIN' | 'DEVELOPER' = (claims.realmRoles ?? []).includes(
      'admin',
    )
      ? 'ADMIN'
      : 'DEVELOPER';

    // 모든 분기에서 공통으로 갱신할 필드 (claim 캐시 + 권한 동기화).
    const syncData = {
      role,
      email: claims.email ?? null,
      emailVerified: claims.emailVerified ?? false,
      lastLoginAt: new Date(),
    };

    const bySub = await this.prisma.user.findUnique({
      where: { keycloakId: claims.sub },
    });
    if (bySub) {
      const updated = await this.prisma.user.update({
        where: { id: bySub.id },
        data: syncData,
      });
      return this.sanitize(updated);
    }

    const byUsername = await this.prisma.user.findUnique({
      where: { username: claims.username },
    });
    if (byUsername) {
      const linked = await this.prisma.user.update({
        where: { id: byUsername.id },
        data: { keycloakId: claims.sub, ...syncData },
      });
      return this.sanitize(linked);
    }

    const created = await this.prisma.user.create({
      data: {
        username: claims.username,
        keycloakId: claims.sub,
        name: claims.name ?? claims.username,
        department: '',
        ...syncData,
      },
    });
    return this.sanitize(created);
  }

  // Cycle 43 — OIDC callback 에서 자체 JWT(docspace_session) 발급에 재사용.
  // jwt.strategy 가 검증하는 페이로드 형태({sub, username, role})를 그대로 유지.
  issueToken(user: { id: string; username: string; role: string }): string {
    return this.signToken(user);
  }

  private signToken(user: {
    id: string;
    username: string;
    role: string;
  }): string {
    return this.jwt.sign({
      sub: user.id,
      username: user.username,
      role: user.role,
    });
  }
}
