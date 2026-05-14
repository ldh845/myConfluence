import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSpaceDto } from './dto/create-space.dto';

// 사이드바/디렉터리에서 공통으로 쓰는 pages select.
const PAGES_INCLUDE = {
  pages: {
    // FR-024 (Cycle 18-1a) — 휴지통 페이지는 제외.
    where: { deletedAt: null },
    // FR-021 (Cycle 19a) — position 우선 정렬.
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      title: true,
      parentId: true,
      spaceId: true,
      updatedAt: true,
      // Cycle 30 — /spaces "내 공간" 탭 필터용.
      authorId: true,
    },
  },
} satisfies Prisma.SpaceInclude;

@Injectable()
export class SpacesService {
  constructor(private readonly prisma: PrismaService) {}

  // Cycle 32 — SITE 전체 + (인증 시) 본인 PERSONAL 공간만. 남의 개인 공간은 숨김.
  findAll(userId?: string | null) {
    return this.prisma.space.findMany({
      where: {
        OR: [
          { type: 'SITE' },
          ...(userId
            ? [{ type: 'PERSONAL' as const, ownerId: userId }]
            : []),
        ],
      },
      orderBy: { createdAt: 'asc' },
      include: PAGES_INCLUDE,
    });
  }

  create(dto: CreateSpaceDto) {
    // 일반 생성은 SITE (스키마 default).
    return this.prisma.space.create({
      data: { name: dto.name, description: dto.description ?? null },
    });
  }

  // Cycle 32 — 사용자의 개인 공간 lazy 생성. 없으면 만들고, 있으면 그대로 반환.
  async getOrCreatePersonal(user: { id: string; name: string }) {
    const existing = await this.prisma.space.findFirst({
      where: { type: 'PERSONAL', ownerId: user.id },
      include: PAGES_INCLUDE,
    });
    if (existing) return existing;
    return this.prisma.space.create({
      data: {
        name: `${user.name}의 개인 공간`,
        description: '개인 작업 공간',
        type: 'PERSONAL',
        ownerId: user.id,
      },
      include: PAGES_INCLUDE,
    });
  }
}
