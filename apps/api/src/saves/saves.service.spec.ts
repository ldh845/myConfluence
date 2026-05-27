import { Test, TestingModule } from '@nestjs/testing';
import { SavesService } from './saves.service';
import { PrismaService } from '../prisma/prisma.service';

// Cycle 53 — SavesService 단위 검증 (PrismaService mock).
//   - save: composite PK 로 upsert (idempotent)
//   - unsave: deleteMany (없어도 무해)
//   - isSaved: findUnique → null 처리

describe('SavesService', () => {
  let service: SavesService;
  let prismaMock: {
    savedPage: {
      upsert: jest.Mock;
      deleteMany: jest.Mock;
      findUnique: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaMock = {
      savedPage: {
        upsert: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SavesService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get<SavesService>(SavesService);
  });

  describe('save', () => {
    it('composite PK upsert 로 idempotent 저장', async () => {
      await service.save('u-1', 'p-1');
      expect(prismaMock.savedPage.upsert).toHaveBeenCalledWith({
        where: { userId_pageId: { userId: 'u-1', pageId: 'p-1' } },
        update: {},
        create: { userId: 'u-1', pageId: 'p-1' },
      });
    });

    it('두 번 호출해도 같은 upsert 인자 — race 안전', async () => {
      await service.save('u-1', 'p-1');
      await service.save('u-1', 'p-1');
      expect(prismaMock.savedPage.upsert).toHaveBeenCalledTimes(2);
      const calls = prismaMock.savedPage.upsert.mock.calls;
      expect(calls[0][0]).toEqual(calls[1][0]);
    });
  });

  describe('unsave', () => {
    it('deleteMany 로 idempotent 해제', async () => {
      await service.unsave('u-1', 'p-1');
      expect(prismaMock.savedPage.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u-1', pageId: 'p-1' },
      });
    });

    it('이미 없어도 throw 하지 않음 (count 0)', async () => {
      prismaMock.savedPage.deleteMany.mockResolvedValueOnce({ count: 0 });
      await expect(service.unsave('u-1', 'p-1')).resolves.toBeUndefined();
    });
  });

  describe('isSaved', () => {
    it('row 있으면 true', async () => {
      prismaMock.savedPage.findUnique.mockResolvedValueOnce({ userId: 'u-1' });
      await expect(service.isSaved('u-1', 'p-1')).resolves.toBe(true);
    });

    it('row 없으면 false', async () => {
      prismaMock.savedPage.findUnique.mockResolvedValueOnce(null);
      await expect(service.isSaved('u-1', 'p-1')).resolves.toBe(false);
    });

    it('composite PK 로 조회', async () => {
      await service.isSaved('u-2', 'p-9');
      expect(prismaMock.savedPage.findUnique).toHaveBeenCalledWith({
        where: { userId_pageId: { userId: 'u-2', pageId: 'p-9' } },
        select: { userId: true },
      });
    });
  });
});
