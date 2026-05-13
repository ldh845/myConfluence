import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// FR-073 (Cycle 25) — 이모지 반응 toggle + 그룹 조회.
// (pageId XOR commentId, emoji, reactorId) 조합으로 idempotent 토글.

@Injectable()
export class ReactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async toggle(params: {
    pageId?: string;
    commentId?: string;
    emoji: string;
    reactorId: string;
    reactorName?: string | null;
  }) {
    const { pageId, commentId, emoji, reactorId, reactorName } = params;
    if (!emoji || !reactorId) {
      throw new BadRequestException({
        error: 'emoji and reactorId required',
      });
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
        reactorId,
      },
    });
    if (existing) {
      await this.prisma.reaction.delete({ where: { id: existing.id } });
      return { reacted: false, reaction: null };
    }
    const reaction = await this.prisma.reaction.create({
      data: {
        emoji,
        reactorId,
        reactorName: reactorName ?? null,
        pageId: pageId ?? null,
        commentId: commentId ?? null,
      },
    });
    return { reacted: true, reaction };
  }

  // emoji별 그룹: count + reactorIds + reactorNames.
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
      select: { emoji: true, reactorId: true, reactorName: true },
    });
    const map = new Map<
      string,
      { emoji: string; count: number; reactorIds: string[]; reactorNames: (string | null)[] }
    >();
    for (const r of rows) {
      let g = map.get(r.emoji);
      if (!g) {
        g = { emoji: r.emoji, count: 0, reactorIds: [], reactorNames: [] };
        map.set(r.emoji, g);
      }
      g.count += 1;
      g.reactorIds.push(r.reactorId);
      g.reactorNames.push(r.reactorName);
    }
    return Array.from(map.values());
  }
}
