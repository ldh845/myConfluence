import { Test, TestingModule } from '@nestjs/testing';
import { ActivitiesService } from './activities.service';
import { PrismaService } from '../prisma/prisma.service';

// Cycle 50 — list() 의 types 다중 IN 필터 검증.
//   - types 단건/다중 → where.type = { in: [...] }
//   - types 없고 type 있음 → where.type = '...' (기존 호환)
//   - types 와 type 동시 → types 우선
//   - 둘 다 없음 → where 에 type 키 없음
// log() 는 best-effort라 간단한 swallow 검증만 추가.

describe('ActivitiesService', () => {
  let service: ActivitiesService;
  let prismaMock: {
    activityLog: {
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaMock = {
      activityLog: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivitiesService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get<ActivitiesService>(ActivitiesService);
  });

  // findMany 와 count 가 같은 where 를 받는지 + 그 where 를 돌려준다.
  const capturedWhere = () => {
    const findArg = prismaMock.activityLog.findMany.mock.calls[0][0];
    const countArg = prismaMock.activityLog.count.mock.calls[0][0];
    expect(countArg.where).toEqual(findArg.where);
    return findArg.where;
  };

  describe('list — types IN 필터', () => {
    it('types 단건 → where.type = { in: [t] }', async () => {
      await service.list({ types: ['page.created'] });
      expect(capturedWhere()).toEqual({ type: { in: ['page.created'] } });
    });

    it('types 다중 → where.type = { in: [...] } 그대로 전달', async () => {
      const types = [
        'page.created',
        'page.published',
        'page.moved',
        'page.copied',
        'comment.created',
      ];
      await service.list({ types });
      expect(capturedWhere()).toEqual({ type: { in: types } });
    });

    it('types 빈 배열 → type 필터 없음 (단일 type 도 없으면)', async () => {
      await service.list({ types: [] });
      const where = capturedWhere();
      expect(where).not.toHaveProperty('type');
    });

    it('types 빈 배열 + type 있음 → 단일 type 로 폴백 (기존 호환)', async () => {
      await service.list({ types: [], type: 'comment.created' });
      expect(capturedWhere()).toEqual({ type: 'comment.created' });
    });

    it('types 없고 type 만 있음 → where.type = string (기존 호환)', async () => {
      await service.list({ type: 'page.published' });
      expect(capturedWhere()).toEqual({ type: 'page.published' });
    });

    it('types 와 type 동시 → types 우선 (type 무시)', async () => {
      await service.list({
        types: ['page.created', 'page.moved'],
        type: 'comment.created',
      });
      expect(capturedWhere()).toEqual({
        type: { in: ['page.created', 'page.moved'] },
      });
    });

    it('둘 다 없음 → where 에 type 키 자체가 없음', async () => {
      await service.list({});
      const where = capturedWhere();
      expect(where).not.toHaveProperty('type');
    });
  });

  describe('list — 다른 필터·페이지네이션', () => {
    it('spaceId 와 actorName 을 결합 (actorName 은 insensitive contains)', async () => {
      await service.list({ spaceId: 'sp-1', actorName: 'kim' });
      expect(capturedWhere()).toEqual({
        spaceId: 'sp-1',
        actorName: { contains: 'kim', mode: 'insensitive' },
      });
    });

    it('limit/offset 기본값 = 20/0, orderBy createdAt desc', async () => {
      await service.list({});
      const arg = prismaMock.activityLog.findMany.mock.calls[0][0];
      expect(arg.take).toBe(20);
      expect(arg.skip).toBe(0);
      expect(arg.orderBy).toEqual({ createdAt: 'desc' });
    });

    it('limit 은 1~100 로 clamp, offset 음수는 0 으로', async () => {
      await service.list({ limit: 500, offset: -5 });
      const arg = prismaMock.activityLog.findMany.mock.calls[0][0];
      expect(arg.take).toBe(100);
      expect(arg.skip).toBe(0);
    });

    it('limit 0 이하는 1 로 clamp', async () => {
      await service.list({ limit: 0 });
      expect(prismaMock.activityLog.findMany.mock.calls[0][0].take).toBe(1);
    });

    it('{items, total} 형태로 반환', async () => {
      prismaMock.activityLog.findMany.mockResolvedValueOnce([{ id: 'a' }]);
      prismaMock.activityLog.count.mockResolvedValueOnce(1);
      const r = await service.list({});
      expect(r).toEqual({ items: [{ id: 'a' }], total: 1 });
    });
  });

  // Cycle 58 — actorId 단일 필터 (프로파일 활동 피드용).
  describe('list — actorId 필터', () => {
    it('actorId 지정 → where 에 actorId 추가', async () => {
      await service.list({ actorId: 'u-1' });
      expect(capturedWhere()).toEqual({ actorId: 'u-1' });
    });

    it('actorId + actorName 동시 → 둘 다 AND', async () => {
      await service.list({ actorId: 'u-1', actorName: 'kim' });
      expect(capturedWhere()).toEqual({
        actorId: 'u-1',
        actorName: { contains: 'kim', mode: 'insensitive' },
      });
    });

    it('actorId + types 동시 → 둘 다 AND', async () => {
      await service.list({
        actorId: 'u-1',
        types: ['page.created', 'comment.created'],
      });
      expect(capturedWhere()).toEqual({
        actorId: 'u-1',
        type: { in: ['page.created', 'comment.created'] },
      });
    });

    it('actorId 미지정 → where 에 actorId 키 없음 (기존 호환)', async () => {
      await service.list({});
      expect(capturedWhere()).not.toHaveProperty('actorId');
    });
  });

  describe('log — best-effort', () => {
    it('정상 케이스: create 호출', async () => {
      await service.log({
        type: 'page.created',
        spaceId: 'sp-1',
        pageId: 'pg-1',
        actorId: 'u-1',
        actorName: 'kim',
        payload: { foo: 'bar' },
      });
      expect(prismaMock.activityLog.create).toHaveBeenCalledTimes(1);
    });

    it('create 가 throw 해도 main flow 에 예외 전파하지 않음 (swallow)', async () => {
      prismaMock.activityLog.create.mockRejectedValueOnce(new Error('db down'));
      await expect(
        service.log({ type: 'comment.created' }),
      ).resolves.toBeUndefined();
    });
  });
});
