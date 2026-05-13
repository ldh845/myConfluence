import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// FR-131 (Cycle 24) — 활동 로그 기록 + 조회.
// log()는 best-effort: main mutation을 깨뜨리지 않도록 내부에서 모든 예외 swallow.

export type ActivityType =
  | 'page.created'
  | 'page.published'
  | 'page.moved'
  | 'page.copied'
  | 'page.soft_deleted'
  | 'page.restored'
  | 'page.permanent_deleted'
  | 'comment.created';

@Injectable()
export class ActivitiesService {
  private readonly logger = new Logger(ActivitiesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    type: ActivityType;
    spaceId?: string | null;
    pageId?: string | null;
    actorName?: string | null;
    payload?: Record<string, unknown> | null;
  }): Promise<void> {
    try {
      await this.prisma.activityLog.create({
        data: {
          type: params.type,
          spaceId: params.spaceId ?? null,
          pageId: params.pageId ?? null,
          actorName: params.actorName ?? null,
          payload: (params.payload ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      // 로그 기록 실패는 main flow에 영향을 주지 않는다.
      this.logger.warn(`activity log failed (${params.type}): ${String(err)}`);
    }
  }

  async list(opts: {
    spaceId?: string;
    type?: string;
    actorName?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
    const offset = Math.max(opts.offset ?? 0, 0);
    const where: Prisma.ActivityLogWhereInput = {
      ...(opts.spaceId ? { spaceId: opts.spaceId } : {}),
      ...(opts.type ? { type: opts.type } : {}),
      ...(opts.actorName
        ? { actorName: { contains: opts.actorName, mode: 'insensitive' } }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          space: { select: { id: true, name: true } },
          page: { select: { id: true, title: true, deletedAt: true } },
        },
      }),
      this.prisma.activityLog.count({ where }),
    ]);
    return { items, total };
  }
}
