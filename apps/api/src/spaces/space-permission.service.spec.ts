import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  SpacePermissionService,
  type Actor,
  type SpaceAccess,
} from './space-permission.service';

// Cycle 74-A — 권한 판정 회귀 방지 핵심 spec.
//   정책: 전역 ADMIN override / PUBLIC(읽기 누구나·편집 로그인·관리 Admin) /
//   PRIVATE(멤버 역할 기반) / PERSONAL(소유자 전용).

const svc = new SpacePermissionService({} as never);

const ADMIN_GLOBAL: Actor = { id: 'g', role: 'ADMIN' };
const DEV: Actor = { id: 'u1', role: 'DEVELOPER' };
const DEV2: Actor = { id: 'u2', role: 'DEVELOPER' };
const ANON: Actor = null;

const access = (
  visibility: SpaceAccess['space']['visibility'],
  ownerId: string | null,
  role: SpaceAccess['role'],
): SpaceAccess => ({ space: { id: 's', visibility, ownerId }, role });

describe('SpacePermissionService — canView', () => {
  it('전역 ADMIN 은 모든 가시성 view 가능', () => {
    expect(svc.canView(access('PRIVATE', null, null), ADMIN_GLOBAL)).toBe(true);
    expect(svc.canView(access('PERSONAL', 'other', null), ADMIN_GLOBAL)).toBe(
      true,
    );
  });
  it('PUBLIC 은 누구나(비멤버/익명 포함) view', () => {
    expect(svc.canView(access('PUBLIC', null, null), DEV)).toBe(true);
    expect(svc.canView(access('PUBLIC', null, null), ANON)).toBe(true);
  });
  it('PRIVATE 는 멤버만 view', () => {
    expect(svc.canView(access('PRIVATE', null, 'VIEWER'), DEV)).toBe(true);
    expect(svc.canView(access('PRIVATE', null, null), DEV)).toBe(false);
    expect(svc.canView(access('PRIVATE', null, null), ANON)).toBe(false);
  });
  it('PERSONAL 은 소유자만 view', () => {
    expect(svc.canView(access('PERSONAL', 'u1', null), DEV)).toBe(true);
    expect(svc.canView(access('PERSONAL', 'u1', null), DEV2)).toBe(false);
  });
});

describe('SpacePermissionService — canEdit', () => {
  it('전역 ADMIN override', () => {
    expect(svc.canEdit(access('PRIVATE', null, null), ADMIN_GLOBAL)).toBe(true);
  });
  it('PUBLIC 은 로그인 사용자 편집(암묵적 Editor), 익명 불가', () => {
    expect(svc.canEdit(access('PUBLIC', null, null), DEV)).toBe(true);
    expect(svc.canEdit(access('PUBLIC', null, null), ANON)).toBe(false);
  });
  it('PRIVATE 는 ADMIN/EDITOR 만 편집, VIEWER/비멤버 불가', () => {
    expect(svc.canEdit(access('PRIVATE', null, 'ADMIN'), DEV)).toBe(true);
    expect(svc.canEdit(access('PRIVATE', null, 'EDITOR'), DEV)).toBe(true);
    expect(svc.canEdit(access('PRIVATE', null, 'VIEWER'), DEV)).toBe(false);
    expect(svc.canEdit(access('PRIVATE', null, null), DEV)).toBe(false);
  });
  it('PERSONAL 은 소유자만 편집', () => {
    expect(svc.canEdit(access('PERSONAL', 'u1', null), DEV)).toBe(true);
    expect(svc.canEdit(access('PERSONAL', 'u1', null), DEV2)).toBe(false);
  });
});

describe('SpacePermissionService — canManage', () => {
  it('전역 ADMIN override', () => {
    expect(svc.canManage(access('PUBLIC', null, null), ADMIN_GLOBAL)).toBe(true);
  });
  it('PUBLIC/PRIVATE 는 멤버 ADMIN 만 관리', () => {
    expect(svc.canManage(access('PUBLIC', null, 'ADMIN'), DEV)).toBe(true);
    expect(svc.canManage(access('PUBLIC', null, 'EDITOR'), DEV)).toBe(false);
    expect(svc.canManage(access('PRIVATE', null, 'ADMIN'), DEV)).toBe(true);
    expect(svc.canManage(access('PRIVATE', null, 'VIEWER'), DEV)).toBe(false);
  });
  it('PERSONAL 은 소유자만 관리', () => {
    expect(svc.canManage(access('PERSONAL', 'u1', null), DEV)).toBe(true);
    expect(svc.canManage(access('PERSONAL', 'u1', null), DEV2)).toBe(false);
  });
});

describe('SpacePermissionService — visibility WHERE 필터', () => {
  it('전역 ADMIN 은 제한 없음({})', () => {
    expect(svc.spaceVisibilityWhere(ADMIN_GLOBAL)).toEqual({});
    expect(svc.pageVisibilityWhere(ADMIN_GLOBAL)).toEqual({});
  });
  // Cycle L7 — 그룹을 통해 권한 받은 비공개 공간도 가시성에 포함(개인 멤버십 가지와 별개 OR).
  it('로그인 사용자: PUBLIC + 멤버 PRIVATE + 그룹 PRIVATE + 본인 PERSONAL', () => {
    expect(svc.spaceVisibilityWhere(DEV)).toEqual({
      OR: [
        { visibility: 'PUBLIC' },
        { visibility: 'PRIVATE', members: { some: { userId: 'u1' } } },
        {
          visibility: 'PRIVATE',
          memberGroups: { some: { group: { members: { some: { userId: 'u1' } } } } },
        },
        { visibility: 'PERSONAL', ownerId: 'u1' },
      ],
    });
  });
  it('페이지 필터는 space 관계로 감싼다', () => {
    expect(svc.pageVisibilityWhere(DEV)).toEqual({
      space: {
        OR: [
          { visibility: 'PUBLIC' },
          { visibility: 'PRIVATE', members: { some: { userId: 'u1' } } },
          {
            visibility: 'PRIVATE',
            memberGroups: { some: { group: { members: { some: { userId: 'u1' } } } } },
          },
          { visibility: 'PERSONAL', ownerId: 'u1' },
        ],
      },
    });
  });
  it('익명은 PUBLIC 만', () => {
    expect(svc.spaceVisibilityWhere(ANON)).toEqual({
      OR: [{ visibility: 'PUBLIC' }],
    });
  });
});

// Cycle L5 (feature/ldh) — assertCanViewPage: pageId → 스페이스 + 페이지 제한 읽기 가드.
//   첨부/다이어그램/버전/댓글/리액션 읽기 엔드포인트가 공통으로 쓰는 프리미티브.
describe('SpacePermissionService — assertCanViewPage (Cycle L5)', () => {
  const build = (opts: {
    page: {
      spaceId: string;
      authorId: string | null;
      restrictionMode: string;
    } | null;
    space?: { visibility: string; ownerId: string | null };
    memberRole?: string | null;
    restriction?: { role: string } | null;
  }) => {
    const prisma = {
      page: {
        findUnique: jest
          .fn()
          .mockResolvedValue(opts.page ? { id: 'p', ...opts.page } : null),
      },
      space: {
        findUnique: jest
          .fn()
          .mockResolvedValue(
            opts.space
              ? { id: opts.page?.spaceId ?? 's', ...opts.space }
              : null,
          ),
      },
      spaceMember: {
        findUnique: jest
          .fn()
          .mockResolvedValue(
            opts.memberRole != null ? { role: opts.memberRole } : null,
          ),
      },
      // Cycle L7 — loadAccess 가 그룹 부여 역할도 조회. 기본 빈 배열(그룹 영향 없음).
      spaceMemberGroup: { findMany: jest.fn().mockResolvedValue([]) },
      pageRestriction: {
        findUnique: jest.fn().mockResolvedValue(opts.restriction ?? null),
      },
      // Cycle L7-2 — assertCanViewPageRestriction 이 그룹 제한 멤버십도 조회.
      //   기본 빈 배열 → 개인 제한만으로 판정(그룹 없으면 종전과 동일 = 회귀 방어).
      pageRestrictionGroup: { findMany: jest.fn().mockResolvedValue([]) },
    };
    return new SpacePermissionService(prisma as never);
  };

  it('페이지 없으면 404', async () => {
    const s = build({ page: null });
    await expect(s.assertCanViewPage('p', DEV)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('PUBLIC 페이지(NONE 제한)는 익명도 통과', async () => {
    const s = build({
      page: { spaceId: 's', authorId: 'a', restrictionMode: 'NONE' },
      space: { visibility: 'PUBLIC', ownerId: null },
    });
    await expect(s.assertCanViewPage('p', ANON)).resolves.toBeUndefined();
  });

  it('PRIVATE 비멤버는 403', async () => {
    const s = build({
      page: { spaceId: 's', authorId: 'a', restrictionMode: 'NONE' },
      space: { visibility: 'PRIVATE', ownerId: null },
      memberRole: null,
    });
    await expect(s.assertCanViewPage('p', DEV)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('VIEW_EDIT 제한: 멤버라도 제한 멤버 아니면 403', async () => {
    const s = build({
      page: { spaceId: 's', authorId: 'other', restrictionMode: 'VIEW_EDIT' },
      space: { visibility: 'PRIVATE', ownerId: null },
      memberRole: 'VIEWER',
      restriction: null,
    });
    await expect(s.assertCanViewPage('p', DEV)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('VIEW_EDIT 제한: 제한 멤버면 통과', async () => {
    const s = build({
      page: { spaceId: 's', authorId: 'other', restrictionMode: 'VIEW_EDIT' },
      space: { visibility: 'PRIVATE', ownerId: null },
      memberRole: 'VIEWER',
      restriction: { role: 'VIEW' },
    });
    await expect(s.assertCanViewPage('p', DEV)).resolves.toBeUndefined();
  });
});

describe('SpacePermissionService — loadAccess', () => {
  it('스페이스 없으면 null', async () => {
    const prisma = {
      space: { findUnique: jest.fn().mockResolvedValue(null) },
      spaceMember: { findUnique: jest.fn() },
    };
    const s = new SpacePermissionService(prisma as never);
    expect(await s.loadAccess('missing', 'u1')).toBeNull();
  });
  it('멤버 역할을 함께 로드', async () => {
    const prisma = {
      space: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 's', visibility: 'PRIVATE', ownerId: null }),
      },
      spaceMember: {
        findUnique: jest.fn().mockResolvedValue({ role: 'EDITOR' }),
      },
      spaceMemberGroup: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const s = new SpacePermissionService(prisma as never);
    const a = await s.loadAccess('s', 'u1');
    expect(a?.role).toBe('EDITOR');
    expect(a?.space.visibility).toBe('PRIVATE');
  });
});

// Cycle L7 (feature/ldh) — 유효 역할 = max(개인 멤버십, 소속 그룹 부여 역할들).
//   회귀 방어: 그룹이 비면 개인 역할 그대로(개인 권한 불변). 그룹은 올리기만 함(deny 없음).
describe('SpacePermissionService — 그룹 결합 유효 역할 (Cycle L7)', () => {
  const build = (
    memberRole: string | null,
    groupRoles: string[],
    visibility = 'PRIVATE',
  ) => {
    const prisma = {
      space: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 's', visibility, ownerId: null }),
      },
      spaceMember: {
        findUnique: jest
          .fn()
          .mockResolvedValue(memberRole ? { role: memberRole } : null),
      },
      spaceMemberGroup: {
        findMany: jest
          .fn()
          .mockResolvedValue(groupRoles.map((role) => ({ role }))),
      },
    };
    return new SpacePermissionService(prisma as never);
  };

  it('개인 없음 + 그룹 뷰어 → VIEWER (canView OK, canEdit 거부)', async () => {
    const s = build(null, ['VIEWER']);
    const a = (await s.loadAccess('s', 'u1'))!;
    expect(a.role).toBe('VIEWER');
    expect(s.canView(a, DEV)).toBe(true);
    expect(s.canEdit(a, DEV)).toBe(false);
  });

  it('개인 없음 + 그룹 편집자 → EDITOR (canEdit OK)', async () => {
    const s = build(null, ['EDITOR']);
    const a = (await s.loadAccess('s', 'u1'))!;
    expect(a.role).toBe('EDITOR');
    expect(s.canEdit(a, DEV)).toBe(true);
  });

  it('개인 뷰어 + 그룹 편집자 → max=EDITOR', async () => {
    const s = build('VIEWER', ['EDITOR']);
    expect((await s.loadAccess('s', 'u1'))!.role).toBe('EDITOR');
  });

  it('개인 편집자 + 그룹 뷰어 → EDITOR (그룹이 강등 못 함)', async () => {
    const s = build('EDITOR', ['VIEWER']);
    expect((await s.loadAccess('s', 'u1'))!.role).toBe('EDITOR');
  });

  it('여러 그룹 → 최고 역할 채택(VIEWER+ADMIN → ADMIN)', async () => {
    const s = build(null, ['VIEWER', 'ADMIN']);
    const a = (await s.loadAccess('s', 'u1'))!;
    expect(a.role).toBe('ADMIN');
    expect(s.canManage(a, DEV)).toBe(true);
  });

  it('그룹 권한 없는 비공개 공간 → null(차단 유지) — 회귀', async () => {
    const s = build(null, []);
    const a = (await s.loadAccess('s', 'u1'))!;
    expect(a.role).toBeNull();
    expect(s.canView(a, DEV)).toBe(false);
  });
});

// Cycle L7-2 (feature/ldh) — 페이지 단위 제한에 그룹 결합.
//   유효 제한 역할 = max(개인 PageRestriction, 소속 그룹 PageRestrictionGroup). EDIT > VIEW.
//   회귀 방어: 작성자/공간관리자/전역 ADMIN 우회 불변, 그룹 없으면 개인 제한 그대로.
describe('SpacePermissionService — 페이지 제한 그룹 결합 (Cycle L7-2)', () => {
  // PUBLIC 공간 기본 → 공간 편집 가드는 항상 통과, 게이트는 오직 페이지 제한.
  const buildEdit = (opts: {
    restrictionMode: string;
    authorId?: string | null;
    personal?: string | null; // 개인 PageRestriction 역할
    groupRoles?: string[]; // 소속 그룹 PageRestrictionGroup 역할들
    visibility?: string;
    memberRole?: string | null;
  }) => {
    const prisma = {
      page: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'p',
          spaceId: 's',
          authorId: opts.authorId ?? 'other',
          restrictionMode: opts.restrictionMode,
        }),
      },
      space: {
        findUnique: jest.fn().mockResolvedValue({
          id: 's',
          visibility: opts.visibility ?? 'PUBLIC',
          ownerId: null,
        }),
      },
      spaceMember: {
        findUnique: jest
          .fn()
          .mockResolvedValue(opts.memberRole ? { role: opts.memberRole } : null),
      },
      spaceMemberGroup: { findMany: jest.fn().mockResolvedValue([]) },
      pageRestriction: {
        findUnique: jest
          .fn()
          .mockResolvedValue(opts.personal ? { role: opts.personal } : null),
      },
      pageRestrictionGroup: {
        findMany: jest
          .fn()
          .mockResolvedValue((opts.groupRoles ?? []).map((role) => ({ role }))),
      },
    };
    return new SpacePermissionService(prisma as never);
  };

  it('EDIT 모드 + 그룹 EDIT → 편집 통과(개인 제한 없어도)', async () => {
    const s = buildEdit({ restrictionMode: 'EDIT', groupRoles: ['EDIT'] });
    await expect(s.assertCanEditPage('p', DEV)).resolves.toBeUndefined();
  });

  it('EDIT 모드 + 개인X·그룹X → 403(비멤버 차단 유지)', async () => {
    const s = buildEdit({ restrictionMode: 'EDIT' });
    await expect(s.assertCanEditPage('p', DEV)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('그룹 VIEW 뿐 → 편집 403(VIEW 는 편집 못 함)', async () => {
    const s = buildEdit({ restrictionMode: 'VIEW_EDIT', groupRoles: ['VIEW'] });
    await expect(s.assertCanEditPage('p', DEV)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('개인 VIEW + 그룹 EDIT → max=EDIT → 편집 통과', async () => {
    const s = buildEdit({
      restrictionMode: 'VIEW_EDIT',
      personal: 'VIEW',
      groupRoles: ['EDIT'],
    });
    await expect(s.assertCanEditPage('p', DEV)).resolves.toBeUndefined();
  });

  it('전역 ADMIN 은 제한 멤버십 없어도 편집 우회(불변)', async () => {
    const s = buildEdit({ restrictionMode: 'VIEW_EDIT' });
    await expect(
      s.assertCanEditPage('p', ADMIN_GLOBAL),
    ).resolves.toBeUndefined();
  });

  it('작성자는 제한 멤버십 없어도 편집 우회(불변)', async () => {
    const s = buildEdit({ restrictionMode: 'VIEW_EDIT', authorId: 'u1' });
    await expect(s.assertCanEditPage('p', DEV)).resolves.toBeUndefined();
  });

  it('공간 관리자는 제한 멤버십 없어도 편집 우회(불변)', async () => {
    const s = buildEdit({
      restrictionMode: 'VIEW_EDIT',
      visibility: 'PRIVATE',
      memberRole: 'ADMIN',
    });
    await expect(s.assertCanEditPage('p', DEV)).resolves.toBeUndefined();
  });

  // assertCanViewPageRestriction — VIEW_EDIT 보기 게이트에 그룹 합류.
  const viewSvc = (personal: string | null, groupRoles: string[]) => {
    const prisma = {
      pageRestriction: {
        findUnique: jest
          .fn()
          .mockResolvedValue(personal ? { role: personal } : null),
      },
      pageRestrictionGroup: {
        findMany: jest
          .fn()
          .mockResolvedValue(groupRoles.map((role) => ({ role }))),
      },
    };
    return new SpacePermissionService(prisma as never);
  };
  const viewPage = {
    id: 'p',
    spaceId: 's',
    authorId: 'other',
    restrictionMode: 'VIEW_EDIT',
  };
  const viewAccess: SpaceAccess = {
    space: { id: 's', visibility: 'PRIVATE', ownerId: null },
    role: 'VIEWER',
  };

  it('VIEW_EDIT + 그룹 VIEW → 보기 통과(역할 무관 멤버)', async () => {
    const s = viewSvc(null, ['VIEW']);
    await expect(
      s.assertCanViewPageRestriction(viewPage, DEV, viewAccess),
    ).resolves.toBeUndefined();
  });

  it('VIEW_EDIT + 개인X·그룹X → 보기 403(회귀)', async () => {
    const s = viewSvc(null, []);
    await expect(
      s.assertCanViewPageRestriction(viewPage, DEV, viewAccess),
    ).rejects.toThrow(ForbiddenException);
  });
});
