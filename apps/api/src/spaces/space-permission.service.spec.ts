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
  it('로그인 사용자: PUBLIC + 멤버 PRIVATE + 본인 PERSONAL', () => {
    expect(svc.spaceVisibilityWhere(DEV)).toEqual({
      OR: [
        { visibility: 'PUBLIC' },
        { visibility: 'PRIVATE', members: { some: { userId: 'u1' } } },
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
      pageRestriction: {
        findUnique: jest.fn().mockResolvedValue(opts.restriction ?? null),
      },
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
    };
    const s = new SpacePermissionService(prisma as never);
    const a = await s.loadAccess('s', 'u1');
    expect(a?.role).toBe('EDITOR');
    expect(a?.space.visibility).toBe('PRIVATE');
  });
});
