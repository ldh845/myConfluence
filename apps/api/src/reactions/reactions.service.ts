import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// FR-073 (Cycle 25) — 이모지 반응 toggle + 그룹 조회.
// FR-001 (Cycle 27e) — userId(User FK)로 식별. 동일 (target, emoji, user)
// 조합은 DB unique 제약. 재호출 시 unique 위반은 idempotent toggle로 해석.

const USER_SELECT = {
  id: true,
  username: true,
  name: true,
  department: true,
  role: true,
} as const;

@Injectable()
export class ReactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async toggle(params: {
    pageId?: string;
    commentId?: string;
    emoji: string;
    userId: string;
  }) {
    const { pageId, commentId, emoji, userId } = params;
    if (!emoji || !userId) {
      throw new BadRequestException({ error: 'emoji and user required' });
    }
    if ((pageId && commentId) || (!pageId && !commentId)) {
      throw new BadRequestException({
        error: 'exactly one of pageId/commentId required',
      });
    }
    // 대상 존재 확인.
    if (pageId) {
      const p = await this.prisma.page.findFirst({
        where: { id: pageId, deletedAt: null },
        select: { id: true },
      });
      if (!p) throw new NotFoundException({ error: 'page not found' });
    } else if (commentId) {
      const c = await this.prisma.comment.findUnique({
        where: { id: commentId },
        select: { id: true },
      });
      if (!c) throw new NotFoundException({ error: 'comment not found' });
    }

    const existing = await this.prisma.reaction.findFirst({
      where: {
        pageId: pageId ?? null,
        commentId: commentId ?? null,
        emoji,
        userId,
      },
    });
    if (existing) {
      await this.prisma.reaction.delete({ where: { id: existing.id } });
      return { reacted: false, reaction: null };
    }
    try {
      const reaction = await this.prisma.reaction.create({
        data: {
          emoji,
          userId,
          pageId: pageId ?? null,
          commentId: commentId ?? null,
        },
        include: { user: { select: USER_SELECT } },
      });
      return { reacted: true, reaction };
    } catch (err) {
      // 동시 토글 race — unique 위반은 이미 누군가 만든 상태로 간주.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        return { reacted: true, reaction: null };
      }
      throw err;
    }
  }

  // emoji별 그룹: count + users 배열(name 포함).
  async listByPage(pageId: string) {
    return this.groupByEmoji({ pageId });
  }

  async listByComment(commentId: string) {
    return this.groupByEmoji({ commentId });
  }

  private async groupByEmoji(where: { pageId?: string; commentId?: string }) {
    const rows = await this.prisma.reaction.findMany({
      where: {
        pageId: where.pageId ?? null,
        commentId: where.commentId ?? null,
      },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: USER_SELECT } },
    });
    const map = new Map<
      string,
      {
        emoji: string;
        count: number;
        userIds: string[];
        userNames: string[];
      }
    >();
    for (const r of rows) {
      let g = map.get(r.emoji);
      if (!g) {
        g = { emoji: r.emoji, count: 0, userIds: [], userNames: [] };
        map.set(r.emoji, g);
      }
      g.count += 1;
      g.userIds.push(r.userId);
      g.userNames.push(r.user?.name ?? '익명');
    }
    return Array.from(map.values());
  }
}
