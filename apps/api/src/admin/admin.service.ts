import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

// Cycle 48 — 관리자 페이지 백엔드 서비스.
// (1) AppConfig: 시스템 설정 single-row (id="singleton"). 마이그레이션에서
//     seed 됐지만 안전망으로 upsert 사용 — 누가 행을 지워도 자동 복구.
// (2) 사용자 목록: Keycloak claim 캐시(email/emailVerified/lastLoginAt) 포함.
//     legacy 시스템 유저는 제외. **계정 CRUD·역할 변경은 여기 없음** —
//     Keycloak 이 source of truth(Admin 콘솔에서 수행).

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

  listUsers() {
    return this.prisma.user.findMany({
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
        lastLoginAt: true,
        createdAt: true,
      },
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
}
