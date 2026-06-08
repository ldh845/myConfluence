import { Logger } from '@nestjs/common';
import { DepartmentGroupService } from './department-group.service';

// Cycle L10 (feature/ldh) — 부서 자동 그룹 배정 단위 검증.
//   resolveOrCreateDepartmentGroup: 매핑 우선 / 동명 / 생성 / 빈값.
//   syncUserDepartmentGroup: undefined 스킵 / DEPARTMENT 생성+멤버십+정리 /
//   LOCAL·KEYCLOAK 스킵(멤버십 불가침·L8 폴백) / 부서 변경 시 옛 멤버십 정리.

const makePrisma = (over: Record<string, unknown> = {}) => ({
  departmentGroupMapping: { findUnique: jest.fn().mockResolvedValue(null) },
  group: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
  groupMember: {
    upsert: jest.fn().mockResolvedValue({}),
    findMany: jest.fn().mockResolvedValue([]),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  ...over,
});

const svc = (prisma: object) =>
  new DepartmentGroupService(prisma as never);

beforeAll(() => {
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});

describe('DepartmentGroupService — resolveOrCreateDepartmentGroup', () => {
  it('매핑이 있으면 매핑 그룹 우선(동명 조회 안 함)', async () => {
    const prisma = makePrisma({
      departmentGroupMapping: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ group: { id: 'gm', source: 'LOCAL' } }),
      },
    });
    const s = svc(prisma);
    const r = await s.resolveOrCreateDepartmentGroup('플랫폼');
    expect(r).toEqual({ id: 'gm', source: 'LOCAL' });
    expect(prisma.group.findUnique).not.toHaveBeenCalled();
  });

  it('매핑 없고 동명 그룹이 있으면 그 그룹', async () => {
    const prisma = makePrisma({
      group: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'gx', source: 'DEPARTMENT' }),
        create: jest.fn(),
      },
    });
    const r = await svc(prisma).resolveOrCreateDepartmentGroup('플랫폼');
    expect(r).toEqual({ id: 'gx', source: 'DEPARTMENT' });
    expect(prisma.group.create).not.toHaveBeenCalled();
  });

  it('둘 다 없으면 source=DEPARTMENT 로 생성', async () => {
    const prisma = makePrisma({
      group: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'gnew', source: 'DEPARTMENT' }),
      },
    });
    const r = await svc(prisma).resolveOrCreateDepartmentGroup('  플랫폼  ');
    expect(prisma.group.create).toHaveBeenCalledWith({
      data: { name: '플랫폼', source: 'DEPARTMENT' },
      select: { id: true, source: true },
    });
    expect(r).toEqual({ id: 'gnew', source: 'DEPARTMENT' });
  });

  it('빈 부서명이면 null(쿼리 없음)', async () => {
    const prisma = makePrisma();
    const r = await svc(prisma).resolveOrCreateDepartmentGroup('   ');
    expect(r).toBeNull();
    expect(prisma.departmentGroupMapping.findUnique).not.toHaveBeenCalled();
  });
});

describe('DepartmentGroupService — syncUserDepartmentGroup', () => {
  it('부서 없음(undefined) → 스킵(아무 동작 없음)', async () => {
    const prisma = makePrisma();
    await svc(prisma).syncUserDepartmentGroup('u1', undefined);
    expect(prisma.group.findUnique).not.toHaveBeenCalled();
    expect(prisma.groupMember.findMany).not.toHaveBeenCalled();
  });

  it('부서 없음(빈 문자열) → 스킵(기존 보존)', async () => {
    const prisma = makePrisma();
    await svc(prisma).syncUserDepartmentGroup('u1', '   ');
    expect(prisma.groupMember.upsert).not.toHaveBeenCalled();
    expect(prisma.groupMember.deleteMany).not.toHaveBeenCalled();
  });

  it('동명 그룹 없음 → DEPARTMENT 생성 + 멤버십 보장 + 옛 부서 멤버십 정리', async () => {
    const prisma = makePrisma({
      group: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'g1', source: 'DEPARTMENT' }),
      },
      groupMember: {
        upsert: jest.fn().mockResolvedValue({}),
        // 현 DEPARTMENT 멤버십: 신규 g1 + 옛 부서 gOld.
        findMany: jest
          .fn()
          .mockResolvedValue([{ groupId: 'g1' }, { groupId: 'gOld' }]),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    });
    await svc(prisma).syncUserDepartmentGroup('u1', '플랫폼');
    expect(prisma.groupMember.upsert).toHaveBeenCalledWith({
      where: { groupId_userId: { groupId: 'g1', userId: 'u1' } },
      update: {},
      create: { groupId: 'g1', userId: 'u1' },
    });
    // 현 부서(g1) 제외하고 옛 부서(gOld)만 제거.
    expect(prisma.groupMember.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', groupId: { in: ['gOld'] } },
    });
  });

  it('동명 LOCAL 그룹 → 멤버십 주입 안 함(불가침) + DEPARTMENT 정리는 수행', async () => {
    const prisma = makePrisma({
      group: {
        findUnique: jest.fn().mockResolvedValue({ id: 'gL', source: 'LOCAL' }),
        create: jest.fn(),
      },
      groupMember: {
        upsert: jest.fn(),
        findMany: jest.fn().mockResolvedValue([{ groupId: 'gOld' }]),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    });
    await svc(prisma).syncUserDepartmentGroup('u1', '플랫폼');
    expect(prisma.group.create).not.toHaveBeenCalled();
    expect(prisma.groupMember.upsert).not.toHaveBeenCalled();
    // keep=null → 모든 DEPARTMENT 멤버십 제거.
    expect(prisma.groupMember.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', groupId: { in: ['gOld'] } },
    });
  });

  it('동명 KEYCLOAK 그룹 → 스킵(L8 claim 우선, 멤버십 안 건드림)', async () => {
    const prisma = makePrisma({
      group: {
        findUnique: jest.fn().mockResolvedValue({ id: 'gk', source: 'KEYCLOAK' }),
        create: jest.fn(),
      },
      groupMember: {
        upsert: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn(),
      },
    });
    await svc(prisma).syncUserDepartmentGroup('u1', '플랫폼');
    expect(prisma.groupMember.upsert).not.toHaveBeenCalled();
    expect(prisma.group.create).not.toHaveBeenCalled();
  });

  it('변경 없음(현 부서 그룹만 멤버) → deleteMany 미호출', async () => {
    const prisma = makePrisma({
      group: {
        findUnique: jest.fn().mockResolvedValue({ id: 'g1', source: 'DEPARTMENT' }),
        create: jest.fn(),
      },
      groupMember: {
        upsert: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([{ groupId: 'g1' }]),
        deleteMany: jest.fn(),
      },
    });
    await svc(prisma).syncUserDepartmentGroup('u1', '플랫폼');
    expect(prisma.groupMember.deleteMany).not.toHaveBeenCalled();
  });
});
