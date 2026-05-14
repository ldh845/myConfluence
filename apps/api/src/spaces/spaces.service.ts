import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivitiesService } from '../activities/activities.service';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly activities: ActivitiesService,
  ) {}

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

  // Cycle 33 — 공간 생성 시 홈(메인) 페이지를 자동 생성하고 homePageId로 지정.
  async create(
    dto: CreateSpaceDto,
    actor?: { id: string; name: string } | null,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const space = await tx.space.create({
        data: { name: dto.name, description: dto.description ?? null },
      });
      const homePage = await tx.page.create({
        data: {
          title: `${space.name} 홈`,
          content: `# ${space.name}\n\n이 공간의 홈 페이지입니다. 자유롭게 편집하세요.`,
          spaceId: space.id,
          parentId: null,
          position: 0,
          authorId: actor?.id ?? null,
          lastEditorId: actor?.id ?? null,
        },
      });
      const updated = await tx.space.update({
        where: { id: space.id },
        data: { homePageId: homePage.id },
        include: PAGES_INCLUDE,
      });
      return { space: updated, homePage };
    });

    // 홈 페이지 생성 활동 로그 (best-effort).
    await this.activities.log({
      type: 'page.created',
      spaceId: result.space.id,
      pageId: result.homePage.id,
      actorId: actor?.id ?? null,
      actorName: actor?.name ?? null,
      payload: { title: result.homePage.title },
    });

    return result.space;
  }

  // Cycle 33 — 공간의 홈 페이지 지정. homePageId 페이지가 그 공간 소속이어야 함.
  async setHomePage(spaceId: string, homePageId: string) {
    const space = await this.prisma.space.findUnique({
      where: { id: spaceId },
      select: { id: true },
    });
    if (!space) throw new NotFoundException({ error: 'space not found' });

    const page = await this.prisma.page.findFirst({
      where: { id: homePageId, deletedAt: null },
      select: { id: true, spaceId: true },
    });
    if (!page) throw new NotFoundException({ error: 'page not found' });
    if (page.spaceId !== spaceId) {
      throw new BadRequestException({
        error: 'home page must belong to this space',
      });
    }

    return this.prisma.space.update({
      where: { id: spaceId },
      data: { homePageId },
      include: PAGES_INCLUDE,
    });
  }

  // Cycle 32 — 사용자의 개인 공간 lazy 생성. 없으면 만들고, 있으면 그대로 반환.
  // Cycle 33 — 새로 만들 때 홈 페이지도 함께 생성.
  async getOrCreatePersonal(user: { id: string; name: string }) {
    const existing = await this.prisma.space.findFirst({
      where: { type: 'PERSONAL', ownerId: user.id },
      include: PAGES_INCLUDE,
    });
    if (existing) return existing;

    const result = await this.prisma.$transaction(async (tx) => {
      const space = await tx.space.create({
        data: {
          name: `${user.name}의 개인 공간`,
          description: '개인 작업 공간',
          type: 'PERSONAL',
          ownerId: user.id,
        },
      });
      const homePage = await tx.page.create({
        data: {
          title: `${space.name} 홈`,
          content: `# ${space.name}\n\n개인 작업 공간의 홈 페이지입니다.`,
          spaceId: space.id,
          parentId: null,
          position: 0,
          authorId: user.id,
          lastEditorId: user.id,
        },
      });
      return tx.space.update({
        where: { id: space.id },
        data: { homePageId: homePage.id },
        include: PAGES_INCLUDE,
      });
    });
    return result;
  }
}
