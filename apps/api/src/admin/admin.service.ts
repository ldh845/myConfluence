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
}
