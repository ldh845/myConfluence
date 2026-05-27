import { Test, TestingModule } from '@nestjs/testing';
import { PagesService } from './pages.service';
import { PrismaService } from '../prisma/prisma.service';
import { AttachmentsService } from '../attachments/attachments.service';
import { ActivitiesService } from '../activities/activities.service';

// Cycle 51 — recent({ limit?, spaceId?, offset? }) 검증.
//   - spaceId 지정 시 where 에 추가
//   - spaceId 미지정 시 기존 동작 (전체 페이지) — /home 호환
//   - draft(publishedAt=null) / 휴지통(deletedAt!=null) 제외 회귀 가드
//   - limit 1~50 clamp, offset 음수→0
//   - orderBy updatedAt desc

describe('PagesService — recent', () => {
  let service: PagesService;
  let prismaMock: {
    page: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prismaMock = {
      page: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PagesService,
        { provide: PrismaService, useValue: prismaMock },
        // recent() 는 다른 서비스를 호출하지 않지만 DI 해소를 위해 빈 mock 제공.
        { provide: AttachmentsService, useValue: {} },
        { provide: ActivitiesService, useValue: {} },
      ],
    }).compile();
    service = module.get<PagesService>(PagesService);
  });

  const findManyArg = () => prismaMock.page.findMany.mock.calls[0][0];

  it('spaceId 지정 → where 에 spaceId 추가, draft/휴지통 제외 유지', () => {
    service.recent({ spaceId: 'sp-1' });
    const arg = findManyArg();
    expect(arg.where).toEqual({
      deletedAt: null,
      NOT: { publishedAt: null },
      spaceId: 'sp-1',
    });
  });

  it('spaceId 미지정 → where 에 spaceId 없음 (전체, 기존 /home 호환)', () => {
    service.recent({ limit: 50 });
    const arg = findManyArg();
    expect(arg.where).toEqual({
      deletedAt: null,
      NOT: { publishedAt: null },
    });
    expect(arg.where).not.toHaveProperty('spaceId');
  });

  it('opts 없이 호출 → limit 기본 10, offset 기본 0, where 동일', () => {
    service.recent();
    const arg = findManyArg();
    expect(arg.take).toBe(10);
    expect(arg.skip).toBe(0);
    expect(arg.where).toEqual({
      deletedAt: null,
      NOT: { publishedAt: null },
    });
  });

  it('limit 50 초과 → 50 으로 clamp', () => {
    service.recent({ limit: 500 });
    expect(findManyArg().take).toBe(50);
  });

  it('limit 0 이하 → 1 로 clamp', () => {
    service.recent({ limit: 0 });
    expect(findManyArg().take).toBe(1);
  });

  it('offset 음수 → 0 으로 clamp', () => {
    service.recent({ offset: -10 });
    expect(findManyArg().skip).toBe(0);
  });

  it('offset 양수 → 그대로 전달', () => {
    service.recent({ offset: 20 });
    expect(findManyArg().skip).toBe(20);
  });

  it('orderBy updatedAt desc 고정', () => {
    service.recent({});
    expect(findManyArg().orderBy).toEqual({ updatedAt: 'desc' });
  });

  it('select 에 카드 표시용 필드 포함 (space.name / author / lastEditor)', () => {
    service.recent({});
    const select = findManyArg().select;
    expect(select).toMatchObject({
      id: true,
      title: true,
      spaceId: true,
      updatedAt: true,
      space: { select: { name: true } },
      author: { select: { id: true, name: true } },
      lastEditor: { select: { id: true, name: true } },
    });
  });

  it('spaceId + offset + limit 결합 동작', () => {
    service.recent({ spaceId: 'sp-2', offset: 10, limit: 20 });
    const arg = findManyArg();
    expect(arg.where).toMatchObject({ spaceId: 'sp-2' });
    expect(arg.skip).toBe(10);
    expect(arg.take).toBe(20);
  });
});
