import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Cycle 59 — 알림 (Notification). 현재 type = 'mention' 만. 향후 확장.

export type NotificationType = 'mention';

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
