import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EffectiveAccessService } from './effective-access.service';
import { SpacePermissionService, type Actor } from './space-permission.service';

// Cycle L9 (feature/ldh) — 접근 권한 역산(effective-access) 단위 검증.
//   개인만 / 그룹만 / 개인+그룹 겹침(via 둘·max) / PERSONAL 소유자 / PUBLIC everyone /
//   비관리자 403 / 전역 ADMIN 별도 / 페이지 제한 좁힘(VIEW_EDIT) / 일관성(canView 참).

const ADMIN_ACTOR: Actor = { id: 'mgr', role: 'ADMIN' };

// max 규칙은 판정 서비스와 동일해야 하므로 동일 rank 로 모킹.
const rank = (r: string | null) =>
  r === 'ADMIN' ? 3 : r === 'EDITOR' ? 2 : r === 'VIEWER' ? 1 : 0;
const permsBase = {
  maxSpaceRole: (a: string | null, b: string | null) => (rank(b) > rank(a) ? b : a),
};

const user = (id: string) => ({
  id,
  username: `${id}_name`,
  name: id.toUpperCase(),
  department: '개발',
});

// 빈 prisma 메서드 세트(테스트별 덮어씀).
const makePrisma = (over: Record<string, unknown> = {}) => ({
  user: { count: jest.fn().mockResolvedValue(0), findUnique: jest.fn() },
  spaceMember: { findMany: jest.fn().mockResolvedValue([]) },
  spaceMemberGroup: { findMany: jest.fn().mockResolvedValue([]) },
  groupMember: { findMany: jest.fn().mockResolvedValue([]) },
  page: { findFirst: jest.fn() },
  pageRestriction: { findMany: jest.fn().mockResolvedValue([]) },
  pageRestrictionGroup: { findMany: jest.fn().mockResolvedValue([]) },
  ...over,
});

const build = (prisma: object, manageResult: unknown) => {
  const perms = {
    ...permsBase,
    assertCanManage: jest.fn().mockResolvedValue(manageResult),
  };
  const svc = new EffectiveAccessService(prisma as never, perms as never);
  return { svc, perms };
};

const PRIVATE = { id: 's', visibility: 'PRIVATE', ownerId: null };

describe('EffectiveAccessService — 공간 effective-access (Cycle L9)', () => {
  it('개인 멤버만 → via personal, 역할 그대로', async () => {
    const prisma = makePrisma({
      spaceMember: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ role: 'EDITOR', user: user('u1') }]),
      },
    });
    const { svc } = build(prisma, { space: PRIVATE, role: 'ADMIN' });
    const res = await svc.spaceEffectiveAccess('s', ADMIN_ACTOR);
    expect(res).toMatchObject({ everyone: false, total: 1 });
    if (res.everyone) throw new Error('unreachable');
    expect(res.users[0]).toMatchObject({
      userId: 'u1',
      role: 'EDITOR',
      via: ['personal'],
    });
  });

  it('그룹만 → 그룹 멤버 펼침, via group', async () => {
    const prisma = makePrisma({
      spaceMemberGroup: {
        findMany: jest.fn().mockResolvedValue([
          { groupId: 'g1', role: 'VIEWER', group: { id: 'g1', name: 'G1' } },
        ]),
      },
      groupMember: {
        findMany: jest.fn().mockResolvedValue([
          { groupId: 'g1', user: user('u2') },
          { groupId: 'g1', user: user('u3') },
        ]),
      },
    });
    const { svc } = build(prisma, { space: PRIVATE, role: 'ADMIN' });
    const res = await svc.spaceEffectiveAccess('s', ADMIN_ACTOR);
    if (res.everyone) throw new Error('unreachable');
    expect(res.total).toBe(2);
    expect(res.users.map((u) => u.userId).sort()).toEqual(['u2', 'u3']);
    expect(res.users[0].via).toEqual([{ group: { id: 'g1', name: 'G1' } }]);
  });

  it('개인+그룹 겹침 → via 둘, role 은 max', async () => {
    const prisma = makePrisma({
      spaceMember: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ role: 'VIEWER', user: user('u1') }]),
      },
      spaceMemberGroup: {
        findMany: jest.fn().mockResolvedValue([
          { groupId: 'g1', role: 'EDITOR', group: { id: 'g1', name: 'G1' } },
        ]),
      },
      groupMember: {
        findMany: jest.fn().mockResolvedValue([{ groupId: 'g1', user: user('u1') }]),
      },
    });
    const { svc } = build(prisma, { space: PRIVATE, role: 'ADMIN' });
    const res = await svc.spaceEffectiveAccess('s', ADMIN_ACTOR);
    if (res.everyone) throw new Error('unreachable');
    expect(res.total).toBe(1);
    expect(res.users[0].role).toBe('EDITOR'); // max(VIEWER, EDITOR)
    expect(res.users[0].via).toEqual([
      'personal',
      { group: { id: 'g1', name: 'G1' } },
    ]);
  });

  it('PERSONAL → 소유자만, via owner', async () => {
    const prisma = makePrisma({
      user: {
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue(user('owner')),
      },
    });
    const { svc } = build(prisma, {
      space: { id: 's', visibility: 'PERSONAL', ownerId: 'owner' },
      role: 'ADMIN',
    });
    const res = await svc.spaceEffectiveAccess('s', ADMIN_ACTOR);
    if (res.everyone) throw new Error('unreachable');
    expect(res.total).toBe(1);
    expect(res.users[0]).toMatchObject({ userId: 'owner', via: ['owner'] });
  });

  it('PUBLIC → everyone:true (전체 덤프 안 함)', async () => {
    const prisma = makePrisma({
      user: { count: jest.fn().mockResolvedValue(3), findUnique: jest.fn() },
    });
    const { svc } = build(prisma, {
      space: { id: 's', visibility: 'PUBLIC', ownerId: null },
      role: 'ADMIN',
    });
    const res = await svc.spaceEffectiveAccess('s', ADMIN_ACTOR);
    expect(res).toEqual({ everyone: true, globalAdmins: { count: 3 } });
  });

  it('전역 ADMIN 은 별도 count 로 표기', async () => {
    const prisma = makePrisma({
      user: { count: jest.fn().mockResolvedValue(2), findUnique: jest.fn() },
      spaceMember: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ role: 'VIEWER', user: user('u1') }]),
      },
    });
    const { svc } = build(prisma, { space: PRIVATE, role: 'ADMIN' });
    const res = await svc.spaceEffectiveAccess('s', ADMIN_ACTOR);
    expect(res.globalAdmins).toEqual({ count: 2 });
  });

  it('비관리자(canManage 실패) → 403 전파', async () => {
    const prisma = makePrisma();
    const perms = {
      ...permsBase,
      assertCanManage: jest
        .fn()
        .mockRejectedValue(new ForbiddenException({ error: 'forbidden' })),
    };
    const svc = new EffectiveAccessService(prisma as never, perms as never);
    await expect(svc.spaceEffectiveAccess('s', { id: 'x', role: 'DEVELOPER' })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('일관성 — 목록의 모든 사용자는 실제 canView 가 참', async () => {
    const prisma = makePrisma({
      spaceMember: {
        findMany: jest.fn().mockResolvedValue([
          { role: 'VIEWER', user: user('u1') },
          { role: 'EDITOR', user: user('u2') },
        ]),
      },
    });
    const { svc } = build(prisma, { space: PRIVATE, role: 'ADMIN' });
    const res = await svc.spaceEffectiveAccess('s', ADMIN_ACTOR);
    if (res.everyone) throw new Error('unreachable');
    const real = new SpacePermissionService({} as never);
    for (const u of res.users) {
      const access = {
        space: { id: 's', visibility: 'PRIVATE' as const, ownerId: null },
        role: u.role,
      };
      expect(real.canView(access, { id: u.userId, role: 'DEVELOPER' })).toBe(true);
    }
  });
});

describe('EffectiveAccessService — 페이지 effective-access (Cycle L9)', () => {
  const seedPage = (restrictionMode: string, authorId: string | null = null) => ({
    page: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: 'p', spaceId: 's', authorId, restrictionMode }),
    },
  });

  it('NONE → 공간 결과와 동일(공간 접근자 그대로)', async () => {
    const prisma = makePrisma({
      ...seedPage('NONE'),
      spaceMember: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ role: 'EDITOR', user: user('u1') }]),
      },
    });
    const { svc } = build(prisma, { space: PRIVATE, role: 'ADMIN' });
    const res = await svc.pageEffectiveAccess('p', ADMIN_ACTOR);
    if (res.everyone) throw new Error('unreachable');
    expect(res.restrictionMode).toBe('NONE');
    expect(res.users[0]).toMatchObject({
      userId: 'u1',
      role: 'EDITOR',
      pageRole: 'EDIT',
    });
  });

  it('미존재 페이지 → 404', async () => {
    const prisma = makePrisma({ page: { findFirst: jest.fn().mockResolvedValue(null) } });
    const { svc } = build(prisma, { space: PRIVATE, role: 'ADMIN' });
    await expect(svc.pageEffectiveAccess('missing', ADMIN_ACTOR)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('VIEW_EDIT → 공간 접근자 ∩ 제한 통과자(좁힘)', async () => {
    // 공간 멤버 4명: uAdmin(ADMIN), uEditor(EDITOR, 작성자), uViewer(VIEWER, 제한 멤버),
    //   uOther(VIEWER, 제한과 무관) → uOther 는 제외되어야 한다(좁힘).
    const allMembers = [
      { role: 'ADMIN', user: user('uAdmin') },
      { role: 'EDITOR', user: user('uEditor') },
      { role: 'VIEWER', user: user('uViewer') },
      { role: 'VIEWER', user: user('uOther') },
    ];
    const prisma = makePrisma({
      ...seedPage('VIEW_EDIT', 'uEditor'),
      spaceMember: {
        findMany: jest.fn().mockImplementation((args: { where?: { role?: string } }) =>
          args?.where?.role === 'ADMIN'
            ? Promise.resolve([{ user: user('uAdmin') }])
            : Promise.resolve(allMembers),
        ),
      },
      pageRestriction: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ role: 'VIEW', user: user('uViewer') }]),
      },
    });
    const { svc } = build(prisma, { space: PRIVATE, role: 'ADMIN' });
    const res = await svc.pageEffectiveAccess('p', ADMIN_ACTOR);
    if (res.everyone) throw new Error('unreachable');
    const ids = res.users.map((u) => u.userId).sort();
    expect(ids).toEqual(['uAdmin', 'uEditor', 'uViewer']); // uOther 제외
    // 작성자/공간관리자/제한멤버 via 표기.
    const author = res.users.find((u) => u.userId === 'uEditor')!;
    expect(author.restrictionVia).toContain('author');
    expect(author.pageRole).toBe('EDIT'); // 작성자 우회
    const viewer = res.users.find((u) => u.userId === 'uViewer')!;
    expect(viewer.restrictionVia).toContain('personal');
    expect(viewer.pageRole).toBe('VIEW'); // VIEW 제한 멤버 → 보기만
  });

  it('VIEW_EDIT + 그룹 제한 멤버 → 그룹 경유로 포함(L7-2)', async () => {
    const prisma = makePrisma({
      ...seedPage('VIEW_EDIT', null),
      spaceMember: {
        findMany: jest.fn().mockImplementation((args: { where?: { role?: string } }) =>
          args?.where?.role === 'ADMIN'
            ? Promise.resolve([])
            : Promise.resolve([{ role: 'EDITOR', user: user('u1') }]),
        ),
      },
      pageRestrictionGroup: {
        findMany: jest.fn().mockResolvedValue([
          { groupId: 'g1', role: 'EDIT', group: { id: 'g1', name: 'G1' } },
        ]),
      },
      groupMember: {
        findMany: jest.fn().mockResolvedValue([{ groupId: 'g1', user: user('u1') }]),
      },
    });
    const { svc } = build(prisma, { space: PRIVATE, role: 'ADMIN' });
    const res = await svc.pageEffectiveAccess('p', ADMIN_ACTOR);
    if (res.everyone) throw new Error('unreachable');
    expect(res.users.map((u) => u.userId)).toEqual(['u1']);
    expect(res.users[0].restrictionVia).toEqual([{ group: { id: 'g1', name: 'G1' } }]);
    expect(res.users[0].pageRole).toBe('EDIT'); // 그룹 EDIT 제한 + 공간 EDITOR
  });
});
