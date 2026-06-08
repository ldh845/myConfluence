import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { assertPasswordPolicy } from './password-policy';
import {
  LOCKOUT_DURATION_MS,
  MAX_FAILED_LOGIN_ATTEMPTS,
  isLocked,
  minutesUntil,
} from './login-lockout';

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
  // Cycle L2 (feature/ldh) — 계정 활성 상태. jwt.strategy 가 매 요청 검증에 사용.
  isActive: boolean;
  // Cycle L3 (feature/ldh) — 로컬 비밀번호 보유 여부(해시 자체는 비노출). 프론트가
  // '비밀번호 변경' 메뉴 노출을 판단하는 데 쓴다. SSO 전용 계정이면 false.
  hasLocalPassword: boolean;
  // Cycle 49 — 사용자별 환경설정. /auth/me 응답 포함, /auth/me/prefs 로 갱신.
  showPersonalSpaceInSidebar: boolean;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

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
    isActive: boolean;
    passwordHash: string | null;
    showPersonalSpaceInSidebar: boolean;
  }): AuthUser {
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      department: user.department,
      role: user.role,
      createdAt: user.createdAt,
      isActive: user.isActive,
      // 해시는 노출하지 않고 보유 여부만 불리언으로 전달.
      hasLocalPassword: user.passwordHash != null,
      showPersonalSpaceInSidebar: user.showPersonalSpaceInSidebar,
    };
  }

  // Cycle 49 — 사용자 prefs 부분 갱신 (PATCH /auth/me/prefs).
  // 현재 prefs 필드는 1개(showPersonalSpaceInSidebar). 향후 prefs 가 늘면
  // 본 메서드 시그니처만 확장 — 컨트롤러·DTO 는 옵셔널 필드 추가만 하면 됨.
  async updateMyPrefs(
    userId: string,
    patch: { showPersonalSpaceInSidebar?: boolean },
  ): Promise<AuthUser> {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: patch,
    });
    return this.sanitize(updated);
  }

  async findById(id: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? this.sanitize(user) : null;
  }

  // Cycle L1 (feature/ldh) — 로컬 로그인(SSO 병행).
  // Cycle 43 이 경로/UI 만 제거하고 User.passwordHash 컬럼은 남겨뒀으므로, 그 위에
  // 자체 로그인을 재개한다. 성공 시 OIDC 콜백과 동일한 issueToken 으로 docspace_session
  // JWT 를 발급(컨트롤러가 쿠키로 심음) → 이후 요청은 기존 jwt.strategy 가 그대로 검증.
  // 에러 의미:
  //   - 사용자 없음 / 비번 불일치 → 401 (계정 존재 여부를 노출하지 않음)
  //   - passwordHash 가 null(= SSO 전용 계정) → 400 'SSO 전용' (로컬 비번 미설정 안내)
  // Cycle L2 (feature/ldh) — 비활성 계정(isActive=false)은 비번이 맞아도 401 거부.
  // Cycle L3 (feature/ldh) — brute-force 잠금. lockedUntil 미래면 423. 오답마다
  //   failedLoginCount+1, 5회 도달 시 15분 잠금(카운트 리셋). 성공 시 카운트/잠금 리셋.
  async localLogin(
    username: string,
    password: string,
  ): Promise<{ user: AuthUser; token: string }> {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) {
      throw new UnauthorizedException({ error: 'invalid credentials' });
    }
    if (!user.isActive) {
      throw new UnauthorizedException({
        error: 'account disabled',
        message: '비활성화된 계정입니다. 관리자에게 문의하세요.',
      });
    }
    if (!user.passwordHash) {
      throw new BadRequestException({
        error: 'sso only',
        message: '이 계정은 SSO 전용입니다. 관리자에게 로컬 비밀번호 설정을 요청하세요.',
      });
    }
    const now = new Date();
    // 이미 잠겨 있으면 비번 검증 없이 423.
    if (isLocked(user.lockedUntil, now)) {
      throw this.lockedException(user.lockedUntil!, now);
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      const nextCount = user.failedLoginCount + 1;
      if (nextCount >= MAX_FAILED_LOGIN_ATTEMPTS) {
        // 임계 도달 → 잠금 설정 + 카운트 리셋.
        const lockedUntil = new Date(now.getTime() + LOCKOUT_DURATION_MS);
        await this.prisma.user.update({
          where: { id: user.id },
          data: { failedLoginCount: 0, lockedUntil },
        });
        throw this.lockedException(lockedUntil, now);
      }
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: nextCount },
      });
      throw new UnauthorizedException({ error: 'invalid credentials' });
    }
    // 성공 — 누적 실패/잠금이 있으면 리셋.
    if (user.failedLoginCount > 0 || user.lockedUntil != null) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil: null },
      });
    }
    return { user: this.sanitize(user), token: this.signToken(user) };
  }

  // 423 Locked 예외 — 남은 분을 안내한다.
  private lockedException(lockedUntil: Date, now: Date): HttpException {
    const mins = minutesUntil(lockedUntil, now);
    return new HttpException(
      {
        error: 'account locked',
        message: `로그인 시도가 많아 계정이 잠겼습니다. 약 ${mins}분 후 다시 시도하세요.`,
      },
      HttpStatus.LOCKED,
    );
  }

  // Cycle L3 (feature/ldh) — 사용자 셀프 비밀번호 변경(PATCH /auth/me/password).
  //   SSO 전용(passwordHash null) → 400, 현재 비번 불일치 → 401, 새 비번 정책 위반 → 400.
  //   성공 시 해시 갱신. (잠금 카운트는 건드리지 않음 — 본인 인증을 이미 통과.)
  async changeMyPassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException({ error: 'invalid credentials' });
    }
    if (!user.passwordHash) {
      throw new BadRequestException({
        error: 'sso only',
        message: 'SSO 전용 계정은 비밀번호를 변경할 수 없습니다.',
      });
    }
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({
        error: 'invalid current password',
        message: '현재 비밀번호가 올바르지 않습니다.',
      });
    }
    assertPasswordPolicy(newPassword);
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    return { ok: true };
  }

  // Cycle 43 — OIDC(Keycloak) 로그인용. callback 에서 ID 토큰 클레임으로 DocSpace
  // User 를 찾거나 만든다. 매핑: keycloakId(sub) 우선 → 없으면 username 으로 기존
  // 계정 링크 → 그래도 없으면 신규 생성(SSO 전용 → passwordHash=null).
  // Cycle 48 — 매 로그인마다 Keycloak claim 동기화:
  //   - role: realm_access.roles 의 'admin' 유무로 ADMIN vs DEVELOPER 토글
  //   - email / emailVerified / lastLoginAt 캐시 갱신
  // Cycle L2 (feature/ldh) — 기존 사용자가 비활성(isActive=false)이면 로그인 거부
  //   (ForbiddenException). 신규 생성 사용자는 default 활성이므로 통과.
  //   컨트롤러(OidcController.callback)가 이를 잡아 /login?error=account_disabled 로 redirect.
  // Cycle L8 (feature/ldh) — claims.groups 로 Keycloak 그룹 멤버십도 매 로그인 동기화.
  async findOrCreateOidcUser(claims: {
    sub: string;
    username: string;
    email?: string;
    emailVerified?: boolean;
    name?: string;
    realmRoles?: string[];
    groups?: string[];
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

    // 계정 해석(sub 우선 → username 링크 → 신규 생성). 비활성이면 분기 안에서 throw.
    let user: Parameters<AuthService['sanitize']>[0];
    const bySub = await this.prisma.user.findUnique({
      where: { keycloakId: claims.sub },
    });
    if (bySub) {
      if (!bySub.isActive) {
        throw new ForbiddenException({ error: 'account disabled' });
      }
      user = await this.prisma.user.update({
        where: { id: bySub.id },
        data: syncData,
      });
    } else {
      const byUsername = await this.prisma.user.findUnique({
        where: { username: claims.username },
      });
      if (byUsername) {
        if (!byUsername.isActive) {
          throw new ForbiddenException({ error: 'account disabled' });
        }
        user = await this.prisma.user.update({
          where: { id: byUsername.id },
          data: { keycloakId: claims.sub, ...syncData },
        });
      } else {
        user = await this.prisma.user.create({
          data: {
            username: claims.username,
            keycloakId: claims.sub,
            name: claims.name ?? claims.username,
            department: '',
            ...syncData,
          },
        });
      }
    }

    // Cycle L8 — 그룹 동기화. best-effort: 실패가 로그인을 막지 않게 에러만 로깅.
    //   claim 미설정(undefined)이면 스킵 → 기존 멤버십 보존.
    if (claims.groups !== undefined) {
      try {
        await this.syncKeycloakGroups(user.id, claims.groups);
      } catch (err) {
        this.logger.error(
          `Keycloak 그룹 동기화 실패 (user=${user.username}) — 로그인은 계속`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }

    return this.sanitize(user);
  }

  // Cycle L8 (feature/ldh) — Keycloak 그룹 멤버십을 claim 집합으로 정렬한다.
  //   규칙:
  //   - 그룹명 upsert: 없으면 source=KEYCLOAK 로 생성. 단 **동명 LOCAL 그룹이 있으면
  //     스킵 + 경고**(LOCAL 그룹을 KEYCLOAK 으로 전환하거나 멤버를 주입하지 않는다).
  //   - 사용자의 **KEYCLOAK source 멤버십만** claim 집합과 일치하도록 추가/제거.
  //     LOCAL 멤버십은 절대 건드리지 않는다(수동 관리 불가침).
  //   - 멤버십 추가/제거는 단일 트랜잭션. 빈 배열이면 KEYCLOAK 멤버십 전부 제거.
  private async syncKeycloakGroups(
    userId: string,
    groupNames: string[],
  ): Promise<void> {
    // 정규화: trim + 빈 문자열 제거 + 중복 제거.
    const desiredNames = [
      ...new Set(groupNames.map((n) => n.trim()).filter((n) => n.length > 0)),
    ];

    // 그룹명 → KEYCLOAK 그룹 id 해석(LOCAL 동명은 스킵).
    const desiredGroupIds: string[] = [];
    for (const name of desiredNames) {
      const existing = await this.prisma.group.findUnique({ where: { name } });
      if (existing) {
        if (existing.source === 'LOCAL') {
          this.logger.warn(
            `Keycloak 그룹 '${name}' 동기화 스킵 — 동명 LOCAL 그룹 존재(보호).`,
          );
          continue;
        }
        desiredGroupIds.push(existing.id);
      } else {
        // 동시 로그인 경쟁으로 unique 충돌 시: 재조회로 복구(best-effort).
        try {
          const created = await this.prisma.group.create({
            data: { name, source: 'KEYCLOAK' },
          });
          desiredGroupIds.push(created.id);
        } catch {
          const again = await this.prisma.group.findUnique({ where: { name } });
          if (again && again.source === 'KEYCLOAK') desiredGroupIds.push(again.id);
        }
      }
    }

    // 현재 사용자의 KEYCLOAK source 멤버십만 조회(LOCAL 은 제외 → 불가침).
    const currentKc = await this.prisma.groupMember.findMany({
      where: { userId, group: { source: 'KEYCLOAK' } },
      select: { groupId: true },
    });
    const currentIds = new Set(currentKc.map((m) => m.groupId));
    const desiredIds = new Set(desiredGroupIds);

    const toAdd = [...desiredIds].filter((id) => !currentIds.has(id));
    const toRemove = [...currentIds].filter((id) => !desiredIds.has(id));

    if (toAdd.length === 0 && toRemove.length === 0) return;

    await this.prisma.$transaction([
      ...(toRemove.length > 0
        ? [
            this.prisma.groupMember.deleteMany({
              where: { userId, groupId: { in: toRemove } },
            }),
          ]
        : []),
      ...(toAdd.length > 0
        ? [
            this.prisma.groupMember.createMany({
              data: toAdd.map((groupId) => ({ groupId, userId })),
            }),
          ]
        : []),
    ]);
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
