import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Cycle 59 — 알림 (Notification). 현재 type = 'mention' / 'comment.created' /
// 'comment.reply' / 'page.updated'. Cycle 60 댓글, Cycle 61 watch 확장.

export type NotificationType =
  | 'mention'
  | 'comment.created'
  | 'comment.reply'
  | 'page.updated';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // 멘션 트리거: 발행 시점에 호출. recipient 별 dedupe(@@unique).
  // 자기 자신 멘션은 호출 측에서 제외.
  async notifyMentions(params: {
    actorId: string;
    pageId: string;
    recipientUserIds: string[];
    payload?: Record<string, unknown>;
  }): Promise<void> {
    const unique = Array.from(new Set(params.recipientUserIds)).filter(
      (id) => id && id !== params.actorId,
    );
    if (unique.length === 0) return;
    // 각 recipient 별 upsert. 같은 조합 이미 있으면 createdAt 갱신 안 함
    // (기존 알림 그대로 — 너무 시끄럽지 않게). 새 알림이면 createdAt now.
    await Promise.all(
      unique.map(async (recipientId) => {
        try {
          await this.prisma.notification.upsert({
            where: {
              Notification_dedupe_key: {
                recipientId,
                actorId: params.actorId,
                pageId: params.pageId,
                type: 'mention',
              },
            },
            update: {
              // 재발행 시에도 알림 새로 알림처럼 보이게 하려면 readAt: null
              //   + createdAt 갱신. 그러나 spam 우려라 update 는 noop.
              // 사용자가 다시 보고 싶으면 페이지 가서 직접 확인.
            },
            create: {
              recipientId,
              actorId: params.actorId,
              pageId: params.pageId,
              type: 'mention',
              payload: (params.payload ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            },
          });
        } catch (err) {
          this.logger.warn(
            `notify mention failed (recipient=${recipientId}): ${String(err)}`,
          );
        }
      }),
    );
  }

  // Cycle 60 — 단일 recipient 에 일반 알림 생성. 자기 자신 skip + best-effort.
  //   notifyMentions 와 같은 upsert dedupe (recipient, actor, page, type) 패턴.
  // Cycle 61 — refresh 옵션: true 면 이미 있는 알림도 readAt=null + createdAt
  //   갱신(재알림). watch 변경 알림처럼 매 발행마다 다시 알려야 하는 type 용.
  //   기본 false (mention/comment 는 한 번만 — spam 방지).
  async notifyOne(params: {
    recipientId: string | null | undefined;
    actorId: string;
    pageId: string;
    type: NotificationType;
    payload?: Record<string, unknown>;
    refresh?: boolean;
  }): Promise<void> {
    const recipient = params.recipientId;
    if (!recipient || recipient === params.actorId) return;
    const payloadValue = (params.payload ??
      Prisma.JsonNull) as Prisma.InputJsonValue;
    try {
      await this.prisma.notification.upsert({
        where: {
          Notification_dedupe_key: {
            recipientId: recipient,
            actorId: params.actorId,
            pageId: params.pageId,
            type: params.type,
          },
        },
        update: params.refresh
          ? { readAt: null, createdAt: new Date(), payload: payloadValue }
          : {},
        create: {
          recipientId: recipient,
          actorId: params.actorId,
          pageId: params.pageId,
          type: params.type,
          payload: payloadValue,
        },
      });
    } catch (err) {
      this.logger.warn(
        `notify ${params.type} failed (recipient=${recipient}): ${String(err)}`,
      );
    }
  }

  // Cycle 61 — 페이지 발행 시 그 페이지의 watcher 들에게 'page.updated' 알림.
  //   WatchList 조회 → 각자 notifyOne(refresh: true). 작성자 본인은 notifyOne
  //   내부에서 자동 skip. best-effort.
  async notifyWatchers(params: {
    actorId: string;
    pageId: string;
    payload?: Record<string, unknown>;
  }): Promise<void> {
    let watchers: { userId: string }[];
    try {
      watchers = await this.prisma.watchList.findMany({
        where: { pageId: params.pageId },
        select: { userId: true },
      });
    } catch (err) {
      this.logger.warn(`notifyWatchers query failed: ${String(err)}`);
      return;
    }
    await Promise.all(
      watchers.map((w) =>
        this.notifyOne({
          recipientId: w.userId,
          actorId: params.actorId,
          pageId: params.pageId,
          type: 'page.updated',
          payload: params.payload,
          refresh: true,
        }),
      ),
    );
  }

  // 본인 알림 목록 (최근 limit, 미읽 우선 정렬은 클라이언트가).
  async listForUser(userId: string, opts: { limit?: number } = {}) {
    const limit = Math.min(Math.max(opts.limit ?? 30, 1), 100);
    const items = await this.prisma.notification.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        actor: {
          select: { id: true, name: true, department: true },
        },
        page: {
          select: { id: true, title: true, deletedAt: true },
        },
      },
    });
    const unreadCount = await this.prisma.notification.count({
      where: { recipientId: userId, readAt: null },
    });
    return { items, unreadCount };
  }

  async markRead(userId: string, id: string): Promise<void> {
    // updateMany 로 본인 소유 가드 + idempotent.
    await this.prisma.notification.updateMany({
      where: { id, recipientId: userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { recipientId: userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
