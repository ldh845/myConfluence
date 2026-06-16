import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SpacesService } from './spaces.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActivitiesService } from '../activities/activities.service';
import { SpacePermissionService } from './space-permission.service';
import { DepartmentGroupService } from '../department/department-group.service';

// Cycle L10 — SpacesService 가 DepartmentGroupService 를 주입받는다(공간 생성 기본 정책).
//   대부분 테스트는 create 를 안 거치므로 no-op 모킹으로 충분.
const deptGroupsMock = {
  resolveOrCreateDepartmentGroup: jest.fn().mockResolvedValue(null),
  syncUserDepartmentGroup: jest.fn().mockResolvedValue(undefined),
};

// Cycle 74-C — 멤버 관리 + 마지막 Admin 보호 회귀 방지.
describe('SpacesService — members (Cycle 74-C)', () => {
  let service: SpacesService;
  let prismaMock: {
    spaceMember: {
      findUnique: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      upsert: jest.Mock;
    };
    user: { findUnique: jest.Mock };
  };

  beforeEach(async () => {
    prismaMock = {
      spaceMember: {
        findUnique: jest.fn(),
        count: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
        upsert: jest.fn().mockResolvedValue({}),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'u-1' }) },
    };
    const permsMock = {
      // canManage 통과로 가정(권한 매트릭스는 space-permission spec 이 검증).
      assertCanManage: jest.fn().mockResolvedValue({
        space: { id: 's', visibility: 'PUBLIC', ownerId: null },
        role: 'ADMIN',
      }),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpacesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ActivitiesService, useValue: { log: jest.fn() } },
        { provide: SpacePermissionService, useValue: permsMock },
        { provide: DepartmentGroupService, useValue: deptGroupsMock },
      ],
    }).compile();
    service = module.get<SpacesService>(SpacesService);
  });

  const ADMIN = { id: 'admin', role: 'ADMIN' };

  it('addMember → 대상 없으면 NotFound', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.addMember('s', 'missing', 'EDITOR', ADMIN),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('addMember → upsert(idempotent)', async () => {
    await service.addMember('s', 'u-1', 'EDITOR', ADMIN);
    expect(prismaMock.spaceMember.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { spaceId_userId: { spaceId: 's', userId: 'u-1' } },
        update: { role: 'EDITOR' },
        create: { spaceId: 's', userId: 'u-1', role: 'EDITOR' },
      }),
    );
  });

  it('마지막 ADMIN 강등 → BadRequest (count=1)', async () => {
    prismaMock.spaceMember.findUnique.mockResolvedValueOnce({ role: 'ADMIN' });
    prismaMock.spaceMember.count.mockResolvedValueOnce(1);
    await expect(
      service.updateMemberRole('s', 'u-1', 'EDITOR', ADMIN),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prismaMock.spaceMember.update).not.toHaveBeenCalled();
  });

  it('ADMIN 2명일 때 강등 허용', async () => {
    prismaMock.spaceMember.findUnique.mockResolvedValueOnce({ role: 'ADMIN' });
    prismaMock.spaceMember.count.mockResolvedValueOnce(2);
    await service.updateMemberRole('s', 'u-1', 'EDITOR', ADMIN);
    expect(prismaMock.spaceMember.update).toHaveBeenCalled();
  });

  it('마지막 ADMIN 제거 → BadRequest', async () => {
    prismaMock.spaceMember.findUnique.mockResolvedValueOnce({ role: 'ADMIN' });
    prismaMock.spaceMember.count.mockResolvedValueOnce(1);
    await expect(
      service.removeMember('s', 'u-1', ADMIN),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prismaMock.spaceMember.delete).not.toHaveBeenCalled();
  });

  it('EDITOR 제거는 admin 카운트 무관하게 허용', async () => {
    prismaMock.spaceMember.findUnique.mockResolvedValueOnce({ role: 'EDITOR' });
    await service.removeMember('s', 'u-2', ADMIN);
    expect(prismaMock.spaceMember.delete).toHaveBeenCalled();
    expect(prismaMock.spaceMember.count).not.toHaveBeenCalled();
  });

  it('존재하지 않는 멤버 역할 변경 → NotFound', async () => {
    prismaMock.spaceMember.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.updateMemberRole('s', 'nope', 'VIEWER', ADMIN),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

// Cycle 74-F — 사이드바 바로가기: 외부 URL 스킴 검증 + reorder.
describe('SpacesService — shortcuts (Cycle 74-F)', () => {
  let service: SpacesService;
  let prismaMock: {
    spaceShortcut: {
      count: jest.Mock;
      create: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      deleteMany: jest.Mock;
      updateMany: jest.Mock;
    };
    page: { findFirst: jest.Mock };
  };

  beforeEach(async () => {
    prismaMock = {
      spaceShortcut: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      page: { findFirst: jest.fn().mockResolvedValue({ id: 'pg-1' }) },
    };
    const permsMock = {
      assertCanManage: jest.fn().mockResolvedValue({
        space: { id: 's', visibility: 'PUBLIC', ownerId: null },
        role: 'ADMIN',
      }),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpacesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ActivitiesService, useValue: { log: jest.fn() } },
        { provide: SpacePermissionService, useValue: permsMock },
        { provide: DepartmentGroupService, useValue: deptGroupsMock },
      ],
    }).compile();
    service = module.get<SpacesService>(SpacesService);
  });

  const ADMIN = { id: 'a', role: 'ADMIN' };

  it('EXTERNAL_URL javascript: 스킴 → BadRequest', async () => {
    await expect(
      service.addShortcut(
        's',
        { type: 'EXTERNAL_URL', label: 'x', target: 'javascript:alert(1)' },
        ADMIN,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prismaMock.spaceShortcut.create).not.toHaveBeenCalled();
  });

  it('EXTERNAL_URL https → 생성', async () => {
    await service.addShortcut(
      's',
      { type: 'EXTERNAL_URL', label: '구글', target: 'https://google.com' },
      ADMIN,
    );
    expect(prismaMock.spaceShortcut.create).toHaveBeenCalled();
  });

  it('INTERNAL_PAGE 대상이 공간에 없으면 BadRequest', async () => {
    prismaMock.page.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.addShortcut(
        's',
        { type: 'INTERNAL_PAGE', label: 'p', target: 'missing' },
        ADMIN,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reorder → ids 순서대로 position 부여', async () => {
    await service.reorderShortcuts('s', ['c', 'a', 'b'], ADMIN);
    const calls = prismaMock.spaceShortcut.updateMany.mock.calls;
    expect(calls).toEqual([
      [{ where: { id: 'c', spaceId: 's' }, data: { position: 0 } }],
      [{ where: { id: 'a', spaceId: 's' }, data: { position: 1 } }],
      [{ where: { id: 'b', spaceId: 's' }, data: { position: 2 } }],
    ]);
  });
});

// Cycle L5-2 (feature/ldh) — 정책 12: setHomePage 는 공간 관리 권한(assertCanManage) 필수.
describe('SpacesService — setHomePage (Cycle L5-2)', () => {
  let service: SpacesService;
  let prismaMock: {
    space: { findUnique: jest.Mock; update: jest.Mock };
    page: { findFirst: jest.Mock };
  };
  let permsMock: { assertCanManage: jest.Mock };

  beforeEach(async () => {
    prismaMock = {
      space: {
        findUnique: jest.fn().mockResolvedValue({ id: 's' }),
        update: jest.fn().mockResolvedValue({ id: 's', homePageId: 'pg' }),
      },
      page: {
        findFirst: jest.fn().mockResolvedValue({ id: 'pg', spaceId: 's' }),
      },
    };
    permsMock = { assertCanManage: jest.fn().mockResolvedValue(undefined) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpacesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ActivitiesService, useValue: { log: jest.fn() } },
        { provide: SpacePermissionService, useValue: permsMock },
        { provide: DepartmentGroupService, useValue: deptGroupsMock },
      ],
    }).compile();
    service = module.get<SpacesService>(SpacesService);
  });

  const ADMIN = { id: 'admin', role: 'ADMIN' };

  it('관리 권한 통과 → 홈 페이지 지정', async () => {
    await service.setHomePage('s', 'pg', ADMIN);
    expect(permsMock.assertCanManage).toHaveBeenCalledWith('s', ADMIN);
    expect(prismaMock.space.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 's' },
        data: { homePageId: 'pg' },
      }),
    );
  });

  it('관리 권한 없으면 403 + update 안 함', async () => {
    permsMock.assertCanManage.mockRejectedValueOnce(
      new ForbiddenException({ error: 'forbidden' }),
    );
    await expect(
      service.setHomePage('s', 'pg', { id: 'u', role: 'DEVELOPER' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prismaMock.space.update).not.toHaveBeenCalled();
  });
});

// Cycle L7 (feature/ldh) — 스페이스 그룹 권한(SpaceMemberGroup) CRUD. canManage 가드.
describe('SpacesService — member-groups (Cycle L7)', () => {
  let service: SpacesService;
  let prismaMock: {
    group: { findUnique: jest.Mock };
    spaceMemberGroup: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      upsert: jest.Mock;
      update: jest.Mock;
      deleteMany: jest.Mock;
    };
  };
  let permsMock: { assertCanManage: jest.Mock };

  beforeEach(async () => {
    prismaMock = {
      group: { findUnique: jest.fn().mockResolvedValue({ id: 'g1' }) },
      spaceMemberGroup: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        upsert: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    permsMock = { assertCanManage: jest.fn().mockResolvedValue(undefined) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpacesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ActivitiesService, useValue: { log: jest.fn() } },
        { provide: SpacePermissionService, useValue: permsMock },
        { provide: DepartmentGroupService, useValue: deptGroupsMock },
      ],
    }).compile();
    service = module.get<SpacesService>(SpacesService);
  });

  const ADMIN = { id: 'admin', role: 'ADMIN' };

  it('addMemberGroup → 그룹 없으면 404', async () => {
    prismaMock.group.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.addMemberGroup('s', 'ghost', 'EDITOR', ADMIN),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prismaMock.spaceMemberGroup.upsert).not.toHaveBeenCalled();
  });

  it('addMemberGroup → upsert(idempotent)', async () => {
    await service.addMemberGroup('s', 'g1', 'EDITOR', ADMIN);
    expect(permsMock.assertCanManage).toHaveBeenCalledWith('s', ADMIN);
    expect(prismaMock.spaceMemberGroup.upsert).toHaveBeenCalledWith({
      where: { spaceId_groupId: { spaceId: 's', groupId: 'g1' } },
      update: { role: 'EDITOR' },
      create: { spaceId: 's', groupId: 'g1', role: 'EDITOR' },
    });
  });

  it('updateMemberGroupRole → 부여 없으면 404', async () => {
    prismaMock.spaceMemberGroup.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.updateMemberGroupRole('s', 'g1', 'ADMIN', ADMIN),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prismaMock.spaceMemberGroup.update).not.toHaveBeenCalled();
  });

  it('updateMemberGroupRole → update', async () => {
    prismaMock.spaceMemberGroup.findUnique.mockResolvedValueOnce({
      groupId: 'g1',
    });
    await service.updateMemberGroupRole('s', 'g1', 'ADMIN', ADMIN);
    expect(prismaMock.spaceMemberGroup.update).toHaveBeenCalledWith({
      where: { spaceId_groupId: { spaceId: 's', groupId: 'g1' } },
      data: { role: 'ADMIN' },
    });
  });

  it('removeMemberGroup → deleteMany', async () => {
    await service.removeMemberGroup('s', 'g1', ADMIN);
    expect(prismaMock.spaceMemberGroup.deleteMany).toHaveBeenCalledWith({
      where: { spaceId: 's', groupId: 'g1' },
    });
  });

  it('관리 권한 없으면 403 (addMemberGroup)', async () => {
    permsMock.assertCanManage.mockRejectedValueOnce(
      new ForbiddenException({ error: 'forbidden' }),
    );
    await expect(
      service.addMemberGroup('s', 'g1', 'EDITOR', {
        id: 'u',
        role: 'DEVELOPER',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prismaMock.spaceMemberGroup.upsert).not.toHaveBeenCalled();
  });
});

// Cycle L10 (feature/ldh) — 공간 생성 기본 정책: 생성자 부서 그룹 EDITOR 자동 부여.
describe('SpacesService — create 부서 기본 정책 (Cycle L10)', () => {
  let service: SpacesService;
  let prismaMock: {
    space: { findFirst: jest.Mock };
    user: { findUnique: jest.Mock };
    spaceMemberGroup: { upsert: jest.Mock };
    $transaction: jest.Mock;
  };
  let deptMock: { resolveOrCreateDepartmentGroup: jest.Mock };

  const ACTOR = { id: 'creator', name: '생성자' };

  beforeEach(async () => {
    prismaMock = {
      space: { findFirst: jest.fn() },
      user: { findUnique: jest.fn() },
      spaceMemberGroup: { upsert: jest.fn().mockResolvedValue({}) },
      // create 의 트랜잭션은 통째로 모킹(콜백 미실행) — 부서 정책 분기만 검증.
      $transaction: jest
        .fn()
        .mockResolvedValue({ space: { id: 'sp-new' }, homePage: { id: 'hp', title: 'Main Page' } }),
    };
    deptMock = {
      resolveOrCreateDepartmentGroup: jest
        .fn()
        .mockResolvedValue({ id: 'g-dept', source: 'DEPARTMENT' }),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpacesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ActivitiesService, useValue: { log: jest.fn().mockResolvedValue(undefined) } },
        {
          provide: SpacePermissionService,
          useValue: { assertCanManage: jest.fn() },
        },
        { provide: DepartmentGroupService, useValue: deptMock },
      ],
    }).compile();
    service = module.get<SpacesService>(SpacesService);
  });

  it('기본(옵션 미지정) + 생성자 department 있음 → 부서 그룹 EDITOR 부여', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ department: '플랫폼' });
    await service.create({ name: '새 공간' }, ACTOR);
    expect(deptMock.resolveOrCreateDepartmentGroup).toHaveBeenCalledWith('플랫폼');
    expect(prismaMock.spaceMemberGroup.upsert).toHaveBeenCalledWith({
      where: { spaceId_groupId: { spaceId: 'sp-new', groupId: 'g-dept' } },
      update: {},
      create: { spaceId: 'sp-new', groupId: 'g-dept', role: 'EDITOR' },
    });
  });

  it('applyDepartmentDefault:false → 부서 그룹 부여 안 함', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ department: '플랫폼' });
    await service.create({ name: '새 공간', applyDepartmentDefault: false }, ACTOR);
    expect(deptMock.resolveOrCreateDepartmentGroup).not.toHaveBeenCalled();
    expect(prismaMock.spaceMemberGroup.upsert).not.toHaveBeenCalled();
  });

  it('생성자 department 없음 → 무동작', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ department: '' });
    await service.create({ name: '새 공간' }, ACTOR);
    expect(deptMock.resolveOrCreateDepartmentGroup).not.toHaveBeenCalled();
    expect(prismaMock.spaceMemberGroup.upsert).not.toHaveBeenCalled();
  });
});
