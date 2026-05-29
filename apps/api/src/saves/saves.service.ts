import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Cycle 53 — '나중을 위해 저장' (Confluence Save for later). 토글은 idempotent —
// 같은 (user, page) 조합은 최대 1행. 페이지 / 사용자 삭제 시 FK Cascade 로 정리.

@Injectable()
export class SavesService {
  constructor(private readonly prisma: PrismaService) {}

  async save(userId: string, pageId: string): Promise<void> {
    // upsert 로 race 안전. composite PK 사용.
    await this.prisma.savedPage.upsert({
      where: { userId_pageId: { userId, pageId } },
      update: {},
      create: { userId, pageId },
    });
  }

  async unsave(userId: string, pageId: string): Promise<void> {
    // deleteMany 로 idempotent — 없어도 무해.
    await this.prisma.savedPage.deleteMany({
      where: { userId, pageId },
    });
  }

  async isSaved(userId: string, pageId: string): Promise<boolean> {
    const row = await this.prisma.savedPage.findUnique({
      where: { userId_pageId: { userId, pageId } },
      select: { userId: true },
    });
    return row !== null;
  }

  // Cycle 69 — 내 저장 페이지 목록(홈 '나중을 위해 저장' 뷰용). 삭제(휴지통)·
  // 미발행(draft) 페이지는 제외해 조회 엔드포인트 정책과 일치. 최근 저장 순.
  async listSaved(userId: string) {
    const rows = await this.prisma.savedPage.findMany({
      where: {
        userId,
        page: { deletedAt: null, publishedAt: { not: null } },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        page: {
          select: {
            id: true,
            title: true,
            // Cycle 70 — 카드 배지용 작업 상태.
            status: true,
            space: { select: { id: true, name: true } },
          },
        },
      },
    });
    return rows.map((r) => ({
      id: r.page.id,
      title: r.page.title,
      status: r.page.status,
      spaceId: r.page.space.id,
      spaceName: r.page.space.name,
    }));
  }
}
