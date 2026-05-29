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
  | 'page.status_changed'
  | 'comment.created';

@Injectable()
export class ActivitiesService {
  private readonly logger = new Logger(ActivitiesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    type: ActivityType;
    spaceId?: string | null;
    pageId?: string | null;
    actorId?: string | null;
    actorName?: string | null;
    payload?: Record<string, unknown> | null;
  }): Promise<void> {
    try {
      await this.prisma.activityLog.create({
        data: {
          type: params.type,
          spaceId: params.spaceId ?? null,
          pageId: params.pageId ?? null,
          actorId: params.actorId ?? null,
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
    // Cycle 50 — 다중 type IN 필터. types 가 있으면 단일 type 보다 우선.
    //   /home UpdatesView 가 사용자 활동 5종(page.created/published/moved/
    //   copied + comment.created)만 받기 위해 사용.
    //   /activity 는 기존 단일 type 그대로 사용(고급 탐색 화면).
    types?: string[];
    actorName?: string;
    // Cycle 58 — 단일 actorId 필터. 사용자 프로파일 페이지의 '이 사용자의
    //   활동' 피드에 사용. actorName 과 동시 사용 시 둘 다 적용(AND).
    actorId?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
    const offset = Math.max(opts.offset ?? 0, 0);
    const typesFilter = opts.types && opts.types.length > 0
      ? { type: { in: opts.types } }
      : opts.type
        ? { type: opts.type }
        : {};
    const where: Prisma.ActivityLogWhereInput = {
      ...(opts.spaceId ? { spaceId: opts.spaceId } : {}),
      ...typesFilter,
      ...(opts.actorName
        ? { actorName: { contains: opts.actorName, mode: 'insensitive' } }
        : {}),
      ...(opts.actorId ? { actorId: opts.actorId } : {}),
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
          actor: {
            select: {
              id: true,
              username: true,
              name: true,
              department: true,
              role: true,
            },
          },
        },
      }),
      this.prisma.activityLog.count({ where }),
    ]);
    return { items, total };
  }
}
