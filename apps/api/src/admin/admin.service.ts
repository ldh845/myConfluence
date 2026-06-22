import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { assertPasswordPolicy } from '../auth/password-policy';
import { isLocked } from '../auth/login-lockout';

// Cycle 48 — 관리자 페이지 백엔드 서비스.
// (1) AppConfig: 시스템 설정 single-row (id="singleton"). 마이그레이션에서
//     seed 됐지만 안전망으로 upsert 사용 — 누가 행을 지워도 자동 복구.
// (2) 사용자 목록: Keycloak claim 캐시(email/emailVerified/lastLoginAt) 포함.
//     legacy 시스템 유저는 제외.
// Cycle L2 (feature/ldh) — 하이브리드 인증의 계정 관리.
//   로컬 계정 생성(createLocalUser) + 활성/비활성 토글(setActive) 추가.
//   SSO 계정 자체의 source 는 여전히 Keycloak 이지만, 로컬 계정 발급/계정 차단은
//   DocSpace 가 직접 수행한다.

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  getConfig() {
    return this.prisma.appConfig.upsert({
      where: { id: 'singleton' },
      update: {},
      create: { id: 'singleton' },
    });
  }

  updateConfig(patch: {
    siteName?: string;
    uploadLimitMb?: number;
    sessionExpireMin?: number;
  }) {
    return this.prisma.appConfig.update({
      where: { id: 'singleton' },
      data: patch,
    });
  }

  getLaunchers() {
    return this.prisma.appLauncherItem.findMany({
      where: { id: { not: 'singleton' } },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });
  }

  replaceLaunchers(items: { name: string; url: string; position?: number }[]) {
    console.log('[AdminService] replaceLaunchers called with:', JSON.stringify(items));
    return this.prisma.$transaction(async (tx) => {
      await tx.appLauncherItem.deleteMany({
        where: { id: { not: 'singleton' } },
      });

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        console.log(`[AdminService] Creating item ${i}:`, JSON.stringify(item));
        await tx.appLauncherItem.create({
          data: {
            name: item.name?.trim() || `바로가기 ${i + 1}`,
            url: item.url?.trim() || 'https://example.com',
            position: i,
          },
        });
      }

      return this.getLaunchers();
    });
  }

  async updateLauncher(id: string, dto: { id?: string; name?: string; url?: string; position?: number }) {
    const existing = await this.prisma.appLauncherItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException({ error: 'launcher item not found' });

    const name = (dto.name ?? existing.name).trim();
    const url = dto.url ?? existing.url;
    if (!name) throw new BadRequestException({ error: 'name is required' });
    if (!url) throw new BadRequestException({ error: 'url is required' });

    return this.prisma.appLauncherItem.update({
      where: { id },
      data: { name, url },
      select: { id: true, name: true, url: true, position: true },
    });
  }

  async deleteLauncher(id: string) {
    if (id === 'singleton') {
      throw new BadRequestException({
        error: 'cannot delete default item',
        message: '기본 항목은 삭제할 수 없습니다.',
      });
    }

    const deleted = await this.prisma.appLauncherItem.delete({ where: { id } });
    const orderedIds = await this.prisma.appLauncherItem.findMany({
      orderBy: { position: 'asc' },
      select: { id: true, name: true, url: true, position: true },
    });
    await this.prisma.$transaction((tx) =>
      Promise.all(
        orderedIds.map((item, index) =>
          tx.appLauncherItem.update({
            where: { id: item.id },
            data: { position: index },
          }),
        ),
      ),
    );
    return deleted;
  }

  // Cycle L2 (feature/ldh) — 응답에 isActive + 계정 유형 플래그를 포함한다.
  //   hasLocalPassword: passwordHash 보유 여부(로컬 로그인 가능). 해시 자체는 비노출.
  //   isSso: keycloakId 보유 여부(SSO 연결). 둘 다 true 면 '혼합' 계정.
  // passwordHash/keycloakId 는 내부 계산에만 쓰고 반환 객체에서 제거한다.
  async listUsers() {
    const now = new Date();
    const users = await this.prisma.user.findMany({
      where: { NOT: { username: 'legacy' } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        username: true,
        email: true,
        emailVerified: true,
        name: true,
        department: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        passwordHash: true,
        keycloakId: true,
        // Cycle L3 — 잠금 상태 노출(해시는 여전히 비노출).
        lockedUntil: true,
      },
    });
    return users.map(({ passwordHash, keycloakId, lockedUntil, ...u }) => ({
      ...u,
      hasLocalPassword: passwordHash != null,
      isSso: keycloakId != null,
      // 현재 잠겨 있는지 + 만료 시각(미래일 때만 의미). UI 배지/해제 버튼용.
      locked: isLocked(lockedUntil, now),
      lockedUntil: isLocked(lockedUntil, now) ? lockedUntil : null,
    }));
  }

  // Cycle L2 (feature/ldh) — 관리자가 로컬 전용 계정을 발급한다.
  // keycloakId=null + passwordHash 세팅 → SSO 없이 로컬 로그인만 가능한 계정.
  // username 중복은 409. 응답에 해시는 노출하지 않는다.
  async createLocalUser(input: {
    username: string;
    name: string;
    department: string;
    email?: string;
    password: string;
  }): Promise<{
    id: string;
    username: string;
    name: string;
    department: string;
    email: string | null;
    role: string;
    isActive: boolean;
    hasLocalPassword: true;
    isSso: false;
  }> {
    // Cycle L3 — 비밀번호 정책(8자+영문+숫자) 검증. 단일 출처.
    assertPasswordPolicy(input.password);
    const existing = await this.prisma.user.findUnique({
      where: { username: input.username },
    });
    if (existing) {
      throw new ConflictException({
        error: 'username taken',
        message: '이미 사용 중인 아이디입니다.',
      });
    }
    const passwordHash = await bcrypt.hash(input.password, 10);
    const created = await this.prisma.user.create({
      data: {
        username: input.username,
        name: input.name,
        department: input.department,
        email: input.email ?? null,
        passwordHash,
        keycloakId: null,
      },
      select: {
        id: true,
        username: true,
        name: true,
        department: true,
        email: true,
        role: true,
        isActive: true,
      },
    });
    return { ...created, hasLocalPassword: true, isSso: false };
  }

  // Cycle L2 (feature/ldh) — 계정 활성/비활성 토글.
  // 자기 자신을 비활성화하는 것은 막는다(셀프 락아웃 방지) → 400.
  // 비활성화 즉시 jwt.strategy 가 기존 세션도 차단한다.
  async setActive(
    userId: string,
    isActive: boolean,
    requesterId: string,
  ): Promise<{ id: string; username: string; isActive: boolean }> {
    if (userId === requesterId && !isActive) {
      throw new BadRequestException({
        error: 'cannot deactivate self',
        message: '자기 자신은 비활성화할 수 없습니다.',
      });
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException({ error: 'user not found' });
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive },
      select: { id: true, username: true, isActive: true },
    });
  }

  // Cycle L4 (feature/ldh) — 로컬 전용 계정의 전역 역할 변경(ADMIN/DEVELOPER).
  //   SSO/혼합 계정(keycloakId 보유)은 거부 → 그 역할의 source 는 Keycloak realm role
  //   이라(Cycle 48) 여기서 바꿔도 다음 OIDC 로그인 때 원복된다. 400 으로 막고 안내.
  //   자기 자신의 역할 변경도 막는다(셀프 권한 박탈/혼란 방지) → 400 (L2 active 토글과 동일 패턴).
  //   role 컬럼은 기존재 → 마이그레이션 없음. jwt.strategy 가 매 요청 DB role 을 읽으므로
  //   변경은 재로그인 없이 다음 요청부터 즉시 반영된다.
  async setRole(
    userId: string,
    role: 'ADMIN' | 'DEVELOPER',
    requesterId: string,
  ): Promise<{ id: string; username: string; role: string }> {
    if (userId === requesterId) {
      throw new BadRequestException({
        error: 'cannot change own role',
        message: '자기 자신의 역할은 변경할 수 없습니다.',
      });
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException({ error: 'user not found' });
    }
    if (user.keycloakId != null) {
      throw new BadRequestException({
        error: 'sso role managed externally',
        message: 'SSO 계정의 역할은 Keycloak 에서 관리됩니다.',
      });
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, username: true, role: true },
    });
  }

  // Cycle L1 (feature/ldh) — 관리자가 대상 사용자의 로컬 비밀번호를 설정/초기화.
  // passwordHash 를 채우면 그 사용자는 SSO 와 별개로 로컬 로그인이 가능해진다
  // (LOCAL_LOGIN_ENABLED 플래그가 켜진 환경에서). bcrypt salt rounds 10.
  // 계정 '생성'은 L2 — 여기선 기존 사용자에 한해 비번만 갱신한다.
  // 응답에 해시는 절대 노출하지 않는다.
  async setLocalPassword(
    userId: string,
    password: string,
  ): Promise<{ id: string; username: string; hasLocalPassword: true }> {
    // Cycle L3 — 비밀번호 정책(8자+영문+숫자) 검증. 단일 출처.
    assertPasswordPolicy(password);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException({ error: 'user not found' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
      select: { id: true, username: true },
    });
    return { ...updated, hasLocalPassword: true };
  }

  // Cycle L3 (feature/ldh) — 로그인 실패 잠금 해제. failedLoginCount/lockedUntil 리셋.
  async unlockUser(
    userId: string,
  ): Promise<{ id: string; username: string; locked: false }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException({ error: 'user not found' });
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: 0, lockedUntil: null },
      select: { id: true, username: true },
    });
    return { ...updated, locked: false };
  }

  // Cycle 89 — 로컬 전용 계정 삭제.
  //   SSO/혼합 계정(keycloakId 보유)은 거부 → 다음 OIDC 로그인 때 재생성되므로.
  //   자기 자신도 거부(셀프 삭제 방지).
  //   Prisma schema 의 onDelete 규칙에 따라 관련 데이터 자동 정리:
  //     - SetNull: authoredPages, editedComments 등 (작성자는 null, 콘텐츠 보존)
  //     - Cascade: spaceMemberships, groupMemberships, apiTokens 등
  //   개인공간(ownedSpaces)은 별도 처리: 공간 자체는 보존(다른 멤버가 있을 수 있음).
  async deleteUser(
    userId: string,
    requesterId: string,
  ): Promise<{ id: string; username: string }> {
    if (userId === requesterId) {
      throw new BadRequestException({
        error: 'cannot delete self',
        message: '자기 자신은 삭제할 수 없습니다.',
      });
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException({ error: 'user not found' });
    }
    if (user.keycloakId != null) {
      throw new BadRequestException({
        error: 'cannot delete sso account',
        message: 'SSO 계정은 Keycloak에서 관리됩니다. 비활성화를 이용하세요.',
      });
    }
    return this.prisma.user.delete({
      where: { id: userId },
      select: { id: true, username: true },
    });
  }
}