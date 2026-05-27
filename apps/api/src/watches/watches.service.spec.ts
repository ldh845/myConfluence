import { Test, TestingModule } from '@nestjs/testing';
import { WatchesService } from './watches.service';
import { PrismaService } from '../prisma/prisma.service';

// Cycle 53 — WatchesService 단위 검증. SavesService 와 구조 동일 → 같은 케이스.

describe('WatchesService', () => {
  let service: WatchesService;
  let prismaMock: {
    watchList: {
      upsert: jest.Mock;
      deleteMany: jest.Mock;
      findUnique: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaMock = {
      watchList: {
        upsert: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WatchesService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get<WatchesService>(WatchesService);
  });

  describe('watch', () => {
    it('composite PK upsert 로 idempotent', async () => {
      await service.watch('u-1', 'p-1');
      expect(prismaMock.watchList.upsert).toHaveBeenCalledWith({
        where: { userId_pageId: { userId: 'u-1', pageId: 'p-1' } },
        update: {},
        create: { userId: 'u-1', pageId: 'p-1' },
      });
    });
  });

  describe('unwatch', () => {
    it('deleteMany 로 idempotent', async () => {
      await service.unwatch('u-1', 'p-1');
      expect(prismaMock.watchList.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u-1', pageId: 'p-1' },
      });
    });

    it('이미 없어도 throw 하지 않음', async () => {
      prismaMock.watchList.deleteMany.mockResolvedValueOnce({ count: 0 });
      await expect(service.unwatch('u-1', 'p-1')).resolves.toBeUndefined();
    });
  });

  describe('isWatching', () => {
    it('row 있으면 true', async () => {
      prismaMock.watchList.findUnique.mockResolvedValueOnce({ userId: 'u-1' });
      await expect(service.isWatching('u-1', 'p-1')).resolves.toBe(true);
    });

    it('row 없으면 false', async () => {
      prismaMock.watchList.findUnique.mockResolvedValueOnce(null);
      await expect(service.isWatching('u-1', 'p-1')).resolves.toBe(false);
    });

    it('다른 사용자는 별도 row 로 조회 (격리)', async () => {
      await service.isWatching('u-A', 'p-1');
      await service.isWatching('u-B', 'p-1');
      expect(prismaMock.watchList.findUnique).toHaveBeenCalledTimes(2);
      const calls = prismaMock.watchList.findUnique.mock.calls;
      expect(calls[0][0].where.userId_pageId.userId).toBe('u-A');
      expect(calls[1][0].where.userId_pageId.userId).toBe('u-B');
    });
  });
});
