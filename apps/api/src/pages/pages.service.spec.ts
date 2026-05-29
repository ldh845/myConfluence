import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PagesService } from './pages.service';
import { PrismaService } from '../prisma/prisma.service';
import { AttachmentsService } from '../attachments/attachments.service';
import { ActivitiesService } from '../activities/activities.service';
import { NotificationsService } from '../notifications/notifications.service';

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
        // Cycle 59 — PagesService 가 NotificationsService 의존.
        { provide: NotificationsService, useValue: { notifyMentions: jest.fn() } },
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

  // Cycle 71 — 상태 필터.
  it('statuses=[TODO] → where 에 status in [TODO]', () => {
    service.recent({ statuses: ['TODO'] });
    expect(findManyArg().where).toMatchObject({ status: { in: ['TODO'] } });
  });

  it("statuses=['NONE'] → where 에 status null", () => {
    service.recent({ statuses: ['NONE'] });
    expect(findManyArg().where).toMatchObject({ status: null });
  });

  it("statuses=['NONE','TODO'] → where 에 OR(null + in)", () => {
    service.recent({ statuses: ['NONE', 'TODO'] });
    expect(findManyArg().where.OR).toEqual(
      expect.arrayContaining([{ status: { in: ['TODO'] } }, { status: null }]),
    );
  });

  it('statuses 미지정 → status 필터 없음', () => {
    service.recent({});
    const where = findManyArg().where;
    expect(where).not.toHaveProperty('status');
    expect(where).not.toHaveProperty('OR');
  });

  // Cycle 71 — 칸반 보드 쿼리.
  it('boardPages(spaceId) → 발행/비삭제 전체, take 500', () => {
    void service.boardPages('sp-1');
    const arg = findManyArg();
    expect(arg.where).toEqual({
      spaceId: 'sp-1',
      deletedAt: null,
      NOT: { publishedAt: null },
    });
    expect(arg.take).toBe(500);
  });

  it('boardPages("") → 쿼리 없이 빈 배열', async () => {
    const r = await service.boardPages('');
    expect(r).toEqual([]);
    expect(prismaMock.page.findMany).not.toHaveBeenCalled();
  });

  // Cycle 73 — 사용자 필터.
  it('boardPages(spaceId, userIds) → where 에 author/lastEditor OR', () => {
    void service.boardPages('sp-1', ['u-1', 'u-2']);
    const where = findManyArg().where;
    expect(where).toMatchObject({ spaceId: 'sp-1', deletedAt: null });
    expect(where.OR).toEqual([
      { authorId: { in: ['u-1', 'u-2'] } },
      { lastEditorId: { in: ['u-1', 'u-2'] } },
    ]);
  });

  it('boardPages(spaceId, []) → userId 필터 없음(OR 없음)', () => {
    void service.boardPages('sp-1', []);
    expect(findManyArg().where).not.toHaveProperty('OR');
  });
});

// Cycle 56 — remove(id, opts.cascade) 검증.
//   - cascade=true → 자손 모두 휴지통 (collectDescendantIds + updateMany)
//   - cascade=false + 자식 있음 → $transaction(자식 parentId 승격, 부모 deletedAt)
//   - cascade=false + 자식 없음 → 단순 updateMany ([self])
//   - 이미 deletedAt → BadRequest
//   - 미존재 → NotFound
//   - actorless 호출 (인증 없음) — actor=null 허용

describe('PagesService — remove (Cycle 56 cascade option)', () => {
  let service: PagesService;
  let prismaMock: {
    page: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      updateMany: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let activitiesMock: { log: jest.Mock };

  beforeEach(async () => {
    prismaMock = {
      page: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
      // $transaction(promiseArray) → 결과 배열 (각 promise 의 결과). 우리는 결과
      // 자체는 사용 안 하므로 빈 배열 반환으로 충분.
      $transaction: jest.fn().mockResolvedValue([]),
    };
    activitiesMock = { log: jest.fn().mockResolvedValue(undefined) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PagesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AttachmentsService, useValue: {} },
        { provide: ActivitiesService, useValue: activitiesMock },
        // Cycle 59 — PagesService 가 NotificationsService 의존.
        {
          provide: NotificationsService,
          useValue: { notifyMentions: jest.fn() },
        },
      ],
    }).compile();
    service = module.get<PagesService>(PagesService);
  });

  const seedActivePage = (
    overrides: Partial<{
      id: string;
      title: string;
      spaceId: string;
      parentId: string | null;
    }> = {},
  ) =>
    prismaMock.page.findUnique.mockResolvedValueOnce({
      id: 'p-1',
      title: 'Doc',
      spaceId: 'sp-1',
      parentId: null,
      deletedAt: null,
      ...overrides,
    });

  it('자식 없음 → cascade 옵션 무관 (단일 updateMany)', async () => {
    seedActivePage();
    prismaMock.page.count.mockResolvedValueOnce(0);
    // collectDescendantIds 의 BFS — 자손 없으면 frontier 빈 children
    prismaMock.page.findMany.mockResolvedValueOnce([]);

    const r = await service.remove('p-1', { cascade: false });

    expect(prismaMock.page.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['p-1'] } },
      data: { deletedAt: expect.any(Date) },
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(r.promotedChildren).toBe(0);
    expect(r.descendantsTrashed).toBe(0);
  });

  it('cascade=true + 자손 있음 → 모두 휴지통 (기존 동작)', async () => {
    seedActivePage();
    prismaMock.page.count.mockResolvedValueOnce(2);
    // BFS 1차: parentId in [p-1] → child a, b
    prismaMock.page.findMany.mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }]);
    // BFS 2차: parentId in [a, b] → 손주 없음
    prismaMock.page.findMany.mockResolvedValueOnce([]);

    const r = await service.remove('p-1', { cascade: true });

    expect(prismaMock.page.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['p-1', 'a', 'b'] } },
      data: { deletedAt: expect.any(Date) },
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(r.descendantsTrashed).toBe(2);
  });

  it('cascade=false (default) + 자식 있음 → 자식 승격 + 부모만 휴지통', async () => {
    seedActivePage({ parentId: 'gp-1' });
    prismaMock.page.count.mockResolvedValueOnce(3);

    const r = await service.remove('p-1', { cascade: false });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    // updateMany 가 두 군데서 호출됨 — count(자식 카운트) 와 transaction 안. count
    // 호출은 한 번이고 (위 mockResolvedValueOnce), transaction 안의 updateMany 가 한 번.
    // 직접 검증: prismaMock.page.updateMany 가 받은 인자 중 parentId 승격이 있는지.
    const calls = prismaMock.page.updateMany.mock.calls;
    const promoteCall = calls.find(
      (c) => c[0].where?.parentId === 'p-1' && 'parentId' in (c[0].data ?? {}),
    );
    expect(promoteCall).toBeDefined();
    expect(promoteCall![0]).toEqual({
      where: { parentId: 'p-1', deletedAt: null },
      data: { parentId: 'gp-1' },
    });
    const updateCall = prismaMock.page.update.mock.calls.find(
      (c) => c[0].where?.id === 'p-1',
    );
    expect(updateCall).toBeDefined();
    expect(updateCall![0].data).toEqual({ deletedAt: expect.any(Date) });
    expect(r.promotedChildren).toBe(3);
    expect(r.descendantsTrashed).toBe(0);
  });

  it('cascade=false + 부모가 root (parentId=null) → 자식들도 root 로 승격', async () => {
    seedActivePage({ parentId: null });
    prismaMock.page.count.mockResolvedValueOnce(1);

    await service.remove('p-1', { cascade: false });

    const promoteCall = prismaMock.page.updateMany.mock.calls.find(
      (c) => c[0].where?.parentId === 'p-1',
    );
    expect(promoteCall![0].data).toEqual({ parentId: null });
  });

  it('opts 없이 호출 → cascade=false 기본 동작', async () => {
    seedActivePage();
    prismaMock.page.count.mockResolvedValueOnce(2);

    const r = await service.remove('p-1');

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(r.promotedChildren).toBe(2);
  });

  it('이미 deletedAt → BadRequestException', async () => {
    prismaMock.page.findUnique.mockResolvedValueOnce({
      id: 'p-1',
      title: 'Doc',
      spaceId: 'sp-1',
      parentId: null,
      deletedAt: new Date(),
    });
    await expect(service.remove('p-1', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('미존재 → NotFoundException', async () => {
    prismaMock.page.findUnique.mockResolvedValueOnce(null);
    await expect(service.remove('missing', {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('actor=null 도 허용 (인증 없이 호출 가능)', async () => {
    seedActivePage();
    prismaMock.page.count.mockResolvedValueOnce(0);
    prismaMock.page.findMany.mockResolvedValueOnce([]);
    await service.remove('p-1', {}, null);
    expect(activitiesMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'page.soft_deleted',
        actorId: null,
        actorName: null,
      }),
    );
  });

  it('activity payload — cascade 시 descendants, single 시 promotedChildren', async () => {
    // cascade
    seedActivePage();
    prismaMock.page.count.mockResolvedValueOnce(2);
    prismaMock.page.findMany.mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }]);
    prismaMock.page.findMany.mockResolvedValueOnce([]);
    await service.remove('p-1', { cascade: true });
    expect(activitiesMock.log.mock.calls[0][0].payload).toMatchObject({
      title: 'Doc',
      descendants: 2,
    });

    // single (자식 승격)
    seedActivePage({ id: 'p-2' });
    prismaMock.page.count.mockResolvedValueOnce(3);
    await service.remove('p-2', { cascade: false });
    expect(activitiesMock.log.mock.calls[1][0].payload).toMatchObject({
      title: 'Doc',
      promotedChildren: 3,
    });
    expect(activitiesMock.log.mock.calls[1][0].payload).not.toHaveProperty(
      'descendants',
    );
  });
});

// Cycle 70 — changeStatus(id, status, user) 검증.
//   - 임시 가드: 작성자(authorId===user.id) 또는 ADMIN 만 허용, 그 외 Forbidden
//   - 비로그인(user=null) Forbidden / 미존재 NotFound
//   - 성공 시 status/statusAt/statusById 갱신 + page.status_changed 활동 기록(payload from/to)
//   - 동일 상태(no-op) → update/log 미호출
describe('PagesService — changeStatus (Cycle 70)', () => {
  let service: PagesService;
  let prismaMock: {
    page: { findFirst: jest.Mock; update: jest.Mock };
  };
  let activitiesMock: { log: jest.Mock };

  beforeEach(async () => {
    prismaMock = {
      page: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    activitiesMock = { log: jest.fn().mockResolvedValue(undefined) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PagesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AttachmentsService, useValue: {} },
        { provide: ActivitiesService, useValue: activitiesMock },
        {
          provide: NotificationsService,
          useValue: { notifyMentions: jest.fn() },
        },
      ],
    }).compile();
    service = module.get<PagesService>(PagesService);
  });

  const AUTHOR = { id: 'u-author', name: '작성자', role: 'DEVELOPER' };
  const ADMIN = { id: 'u-admin', name: '관리자', role: 'ADMIN' };
  const OTHER = { id: 'u-other', name: '타인', role: 'DEVELOPER' };

  // 첫 findFirst = 가드용(select), 둘째 findFirst = findOne(반환값).
  const seed = (authorId: string | null, status: string | null) => {
    prismaMock.page.findFirst
      .mockResolvedValueOnce({ id: 'p-1', spaceId: 'sp-1', authorId, status })
      .mockResolvedValueOnce({ id: 'p-1', status });
  };

  it('비로그인(user=null) → Forbidden', async () => {
    await expect(
      service.changeStatus('p-1', 'TODO', null),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('작성자/ADMIN 아님 → Forbidden, update·log 미호출', async () => {
    prismaMock.page.findFirst.mockResolvedValueOnce({
      id: 'p-1',
      spaceId: 'sp-1',
      authorId: 'u-author',
      status: null,
    });
    await expect(
      service.changeStatus('p-1', 'TODO', OTHER),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prismaMock.page.update).not.toHaveBeenCalled();
    expect(activitiesMock.log).not.toHaveBeenCalled();
  });

  it('미존재 페이지 → NotFound', async () => {
    prismaMock.page.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.changeStatus('missing', 'TODO', ADMIN),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('작성자 → 상태 변경 + page.status_changed 기록(payload from/to)', async () => {
    seed('u-author', null);
    await service.changeStatus('p-1', 'IN_PROGRESS', AUTHOR);
    expect(prismaMock.page.update).toHaveBeenCalledWith({
      where: { id: 'p-1' },
      data: {
        status: 'IN_PROGRESS',
        statusAt: expect.any(Date),
        statusById: 'u-author',
      },
    });
    expect(activitiesMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'page.status_changed',
        pageId: 'p-1',
        actorId: 'u-author',
        payload: { from: null, to: 'IN_PROGRESS' },
      }),
    );
  });

  it('ADMIN(작성자 아님) → 허용', async () => {
    seed('u-author', 'TODO');
    await service.changeStatus('p-1', 'DONE', ADMIN);
    expect(prismaMock.page.update).toHaveBeenCalled();
    expect(activitiesMock.log).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { from: 'TODO', to: 'DONE' } }),
    );
  });

  it('상태 제거(null) → status:null 갱신 + payload to:null', async () => {
    seed('u-author', 'DONE');
    await service.changeStatus('p-1', null, AUTHOR);
    expect(prismaMock.page.update).toHaveBeenCalledWith({
      where: { id: 'p-1' },
      data: { status: null, statusAt: expect.any(Date), statusById: 'u-author' },
    });
    expect(activitiesMock.log).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { from: 'DONE', to: null } }),
    );
  });

  it('동일 상태(no-op) → update·log 미호출', async () => {
    seed('u-author', 'TODO');
    await service.changeStatus('p-1', 'TODO', AUTHOR);
    expect(prismaMock.page.update).not.toHaveBeenCalled();
    expect(activitiesMock.log).not.toHaveBeenCalled();
  });
});
