import { Injectable } from '@nestjs/common';
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
}
