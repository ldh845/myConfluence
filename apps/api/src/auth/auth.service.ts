import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

// FR-001 / FR-002 — 사용자 조회 + 자체 JWT(docspace_session) 발급.
// Cycle 43(2/2): 자체 인증(bcrypt signup/login) 제거 → 로그인은 Keycloak OIDC 단일.
//   계정 매핑/생성은 findOrCreateOidcUser 가 담당(첫 사용자만 자동 ADMIN 규칙 승계).
//   JWT payload: { sub, username, role }. 응답에서 passwordHash는 항상 제외.

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

  // Cycle 43 — OIDC(Keycloak) 로그인용. 기존 자체 인증(signup/login)은 그대로 두고
  // "입구"만 추가. callback 에서 ID 토큰 클레임으로 DocSpace User 를 찾거나 만든다.
  // 매핑: keycloakId(sub) 우선 → 없으면 username(preferred_username)으로 기존 계정
  // 링크 → 그래도 없으면 신규 생성(SSO 전용이라 passwordHash 는 null).
  async findOrCreateOidcUser(claims: {
    sub: string;
    username: string;
    email?: string;
    name?: string;
  }): Promise<AuthUser> {
    const bySub = await this.prisma.user.findUnique({
      where: { keycloakId: claims.sub },
    });
    if (bySub) return this.sanitize(bySub);

    const byUsername = await this.prisma.user.findUnique({
      where: { username: claims.username },
    });
    if (byUsername) {
      const linked = await this.prisma.user.update({
        where: { id: byUsername.id },
        data: { keycloakId: claims.sub },
      });
      return this.sanitize(linked);
    }

    // 첫 사용자만 자동 ADMIN (자체 signup 규칙과 동일).
    const userCount = await this.prisma.user.count();
    const role = userCount === 0 ? 'ADMIN' : 'DEVELOPER';
    const created = await this.prisma.user.create({
      data: {
        username: claims.username,
        keycloakId: claims.sub,
        name: claims.name ?? claims.username,
        department: '',
        role,
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
