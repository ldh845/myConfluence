import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';

// Cycle 59 — NotificationsService 단위 검증 (PrismaService mock).

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prismaMock: {
    notification: {
      upsert: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaMock = {
      notification: {
        upsert: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get<NotificationsService>(NotificationsService);
  });

  describe('notifyMentions', () => {
    it('수신자 1명 → upsert 1회 (composite key 로)', async () => {
      await service.notifyMentions({
        actorId: 'a-1',
        pageId: 'p-1',
        recipientUserIds: ['u-1'],
      });
      expect(prismaMock.notification.upsert).toHaveBeenCalledTimes(1);
      const arg = prismaMock.notification.upsert.mock.calls[0][0];
      expect(arg.where).toEqual({
        Notification_dedupe_key: {
          recipientId: 'u-1',
          actorId: 'a-1',
          pageId: 'p-1',
          type: 'mention',
        },
      });
      expect(arg.create).toMatchObject({
        recipientId: 'u-1',
        actorId: 'a-1',
        pageId: 'p-1',
        type: 'mention',
      });
    });

    it('자기 자신 멘션은 skip (recipient === actor)', async () => {
      await service.notifyMentions({
        actorId: 'u-1',
        pageId: 'p-1',
        recipientUserIds: ['u-1', 'u-2'],
      });
      expect(prismaMock.notification.upsert).toHaveBeenCalledTimes(1);
      const arg = prismaMock.notification.upsert.mock.calls[0][0];
      expect(arg.where.Notification_dedupe_key.recipientId).toBe('u-2');
    });

    it('중복 userId dedupe', async () => {
      await service.notifyMentions({
        actorId: 'a-1',
        pageId: 'p-1',
        recipientUserIds: ['u-1', 'u-1', 'u-2', 'u-2'],
      });
      expect(prismaMock.notification.upsert).toHaveBeenCalledTimes(2);
    });

    it('빈 배열 → 호출 0', async () => {
      await service.notifyMentions({
        actorId: 'a-1',
        pageId: 'p-1',
        recipientUserIds: [],
      });
      expect(prismaMock.notification.upsert).not.toHaveBeenCalled();
    });

    it('upsert 가 throw 해도 main flow 에 예외 전파 X (best-effort)', async () => {
      prismaMock.notification.upsert.mockRejectedValueOnce(new Error('db'));
      await expect(
        service.notifyMentions({
          actorId: 'a-1',
          pageId: 'p-1',
          recipientUserIds: ['u-1'],
        }),
      ).resolves.toBeUndefined();
    });
  });

  // Cycle 60 — notifyOne (단일 recipient 일반 알림, 댓글/답글 트리거용)
  describe('notifyOne', () => {
    it('정상 recipient → upsert (composite key, create payload)', async () => {
      await service.notifyOne({
        recipientId: 'u-1',
        actorId: 'u-2',
        pageId: 'p-1',
        type: 'comment.created',
        payload: { pageTitle: '제목', actorName: '김' },
      });
      expect(prismaMock.notification.upsert).toHaveBeenCalledTimes(1);
      const arg = prismaMock.notification.upsert.mock.calls[0][0];
      expect(arg.where).toEqual({
        Notification_dedupe_key: {
          recipientId: 'u-1',
          actorId: 'u-2',
          pageId: 'p-1',
          type: 'comment.created',
        },
      });
      expect(arg.create).toMatchObject({
        recipientId: 'u-1',
        type: 'comment.created',
      });
    });

    it('comment.reply 타입도 동일 패턴', async () => {
      await service.notifyOne({
        recipientId: 'u-1',
        actorId: 'u-2',
        pageId: 'p-1',
        type: 'comment.reply',
      });
      const arg = prismaMock.notification.upsert.mock.calls[0][0];
      expect(arg.where.Notification_dedupe_key.type).toBe('comment.reply');
    });

    it('recipient null → skip (페이지/댓글 작성자 없음)', async () => {
      await service.notifyOne({
        recipientId: null,
        actorId: 'u-2',
        pageId: 'p-1',
        type: 'comment.created',
      });
      expect(prismaMock.notification.upsert).not.toHaveBeenCalled();
    });

    it('recipient === actor → skip (자기 자신 댓글)', async () => {
      await service.notifyOne({
        recipientId: 'u-1',
        actorId: 'u-1',
        pageId: 'p-1',
        type: 'comment.created',
      });
      expect(prismaMock.notification.upsert).not.toHaveBeenCalled();
    });

    it('upsert throw 해도 main flow 예외 전파 X (best-effort)', async () => {
      prismaMock.notification.upsert.mockRejectedValueOnce(new Error('db'));
      await expect(
        service.notifyOne({
          recipientId: 'u-1',
          actorId: 'u-2',
          pageId: 'p-1',
          type: 'comment.reply',
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('listForUser', () => {
    it('limit clamp 1~100, 기본 30', async () => {
      await service.listForUser('u-1', { limit: 500 });
      expect(prismaMock.notification.findMany.mock.calls[0][0].take).toBe(100);
      await service.listForUser('u-1', { limit: 0 });
      expect(prismaMock.notification.findMany.mock.calls[1][0].take).toBe(1);
      await service.listForUser('u-1');
      expect(prismaMock.notification.findMany.mock.calls[2][0].take).toBe(30);
    });

    it('recipient 본인 가드 + actor/page include + unreadCount', async () => {
      prismaMock.notification.findMany.mockResolvedValueOnce([{ id: 'n-1' }]);
      prismaMock.notification.count.mockResolvedValueOnce(3);
      const r = await service.listForUser('u-1');
      expect(prismaMock.notification.findMany.mock.calls[0][0].where).toEqual({
        recipientId: 'u-1',
      });
      expect(prismaMock.notification.count.mock.calls[0][0].where).toEqual({
        recipientId: 'u-1',
        readAt: null,
      });
      expect(r.unreadCount).toBe(3);
    });
  });

  describe('markRead / markAllRead', () => {
    it('markRead: updateMany 본인 + 미읽 가드, readAt now', async () => {
      await service.markRead('u-1', 'n-1');
      const arg = prismaMock.notification.updateMany.mock.calls[0][0];
      expect(arg.where).toEqual({ id: 'n-1', recipientId: 'u-1', readAt: null });
      expect(arg.data.readAt).toBeInstanceOf(Date);
    });

    it('markAllRead: updateMany 본인 + 미읽 전체', async () => {
      await service.markAllRead('u-1');
      const arg = prismaMock.notification.updateMany.mock.calls[0][0];
      expect(arg.where).toEqual({ recipientId: 'u-1', readAt: null });
    });
  });
});
