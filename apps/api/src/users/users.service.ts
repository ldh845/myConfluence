import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Cycle 31 — 사용자 목록. SearchOverlay 의 Contributor 필터 드롭다운용.
// passwordHash 는 절대 노출하지 않는다. 'legacy' 시스템 유저는 제외.
// Cycle 55 — opts.q (insensitive contains, name OR username) 추가. 멘션 popup
//   에서 @ 입력 후 자동완성용. q 없으면 기존 동작 그대로 (회귀 없음).
// Cycle 58 — findOne(id) 추가. 사용자 프로파일 페이지용. legacy 제외, 민감
//   필드(passwordHash/keycloakId) 미노출.

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        name: true,
        department: true,
        role: true,
        createdAt: true,
      },
    });
    if (!user || user.username === 'legacy') {
      throw new NotFoundException({ error: 'user not found' });
    }
    return user;
  }

  findAll(opts: { q?: string } = {}) {
    const q = opts.q?.trim();
    const where: Prisma.UserWhereInput = {
      NOT: { username: 'legacy' },
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { username: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    return this.prisma.user.findMany({
      where,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, department: true },
    });
  }
}
