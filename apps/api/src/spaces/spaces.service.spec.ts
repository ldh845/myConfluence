import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SpacesService } from './spaces.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActivitiesService } from '../activities/activities.service';
import { SpacePermissionService } from './space-permission.service';

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
