import { Injectable, NotFoundException } from '@nestjs/common';
import { SpaceRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SpacePermissionService, type Actor } from './space-permission.service';

// Cycle L9 (feature/ldh) — 접근 권한 역산(effective-access) API.
//   기존 판정은 "이 사용자가 이 자원에 접근되나?"(사용자→예/아니오) 방향뿐이라,
//   관리자가 "이 공간/페이지 누가 볼 수 있지?"(자원→사용자 전부+경로)에 답할 수 없었다.
//   본 서비스가 그 역방향을 만든다. canView/loadAccess 와 같은 데이터·규칙을 써서
//   결과가 실제 판정과 일치하도록 한다(개인 SpaceMember ∪ 그룹 SpaceMemberGroup, max).
//   - 전역 ADMIN 은 개별 나열 대신 globalAdmins:{count} 로 별도 표기.
//   - PUBLIC 공간은 전체 사용자 덤프를 피하려 { everyone:true } 플래그.

// 공간 접근 경로: 개인 멤버십 / 소유자 / 그룹 부여.
export type AccessVia = 'personal' | 'owner' | { group: { id: string; name: string } };

export type SpaceAccessUser = {
  userId: string;
  username: string;
  name: string;
  department: string | null;
  role: SpaceRole; // 유효(개인·그룹 max) 공간 역할
  via: AccessVia[];
};

export type SpaceEffectiveAccess =
  | { everyone: true; globalAdmins: { count: number } }
  | {
      everyone: false;
      users: SpaceAccessUser[];
      total: number;
      limit: number;
      offset: number;
      globalAdmins: { count: number };
    };

// 페이지 제한 통과 경로(공간 접근 경로에 더해).
export type PageRestrictionVia =
  | 'author'
  | 'space-manager'
  | 'personal'
  | { group: { id: string; name: string } };

export type PageAccessUser = SpaceAccessUser & {
  pageRole: 'EDIT' | 'VIEW'; // 페이지에서의 유효 행위 능력
  restrictionVia?: PageRestrictionVia[]; // 제한 모드일 때 통과 근거
};

export type PageEffectiveAccess =
  | {
      everyone: true;
      restrictionMode: 'NONE' | 'EDIT';
      globalAdmins: { count: number };
    }
  | {
      everyone: false;
      restrictionMode: 'NONE' | 'EDIT' | 'VIEW_EDIT';
      users: PageAccessUser[];
      total: number;
      limit: number;
      offset: number;
      globalAdmins: { count: number };
    };

// 사용자 최소 정보 select (목록 표시용).
const USER_SELECT = {
  id: true,
  username: true,
  name: true,
  department: true,
} as const;

type UserLite = {
  id: string;
  username: string;
  name: string;
  department: string | null;
};

type SpaceLite = {
  id: string;
  visibility: string;
  ownerId: string | null;
};

type Paging = { limit: number; offset: number };

@Injectable()
export class EffectiveAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly perms: SpacePermissionService,
  ) {}

  private readonly DEFAULT_LIMIT = 50;

  private normalizePaging(p?: Partial<Paging>): Paging {
    const limit = Math.min(
      Math.max(1, Math.floor(p?.limit ?? this.DEFAULT_LIMIT)),
      200,
    );
    const offset = Math.max(0, Math.floor(p?.offset ?? 0));
    return { limit, offset };
  }

  private countGlobalAdmins(): Promise<number> {
    return this.prisma.user.count({
      where: { role: 'ADMIN', isActive: true },
    });
  }

  private canEditSpace(visibility: string, role: SpaceRole | null): boolean {
    if (visibility === 'PUBLIC') return true; // 로그인 사용자 암묵적 Editor
    return role === 'EDITOR' || role === 'ADMIN';
  }

  // ─── 공간 접근자 집합(게이트 없음) ───────────────────────────────────────────
  //   PUBLIC → everyone(열거 안 함). PRIVATE → 개인 멤버 ∪ 그룹 멤버(max). PERSONAL → 소유자.
  private async computeSpaceUsers(
    space: SpaceLite,
  ): Promise<{ everyone: boolean; map: Map<string, SpaceAccessUser> }> {
    if (space.visibility === 'PUBLIC') {
      return { everyone: true, map: new Map() };
    }
    const map = new Map<string, SpaceAccessUser>();

    if (space.visibility === 'PERSONAL') {
      if (space.ownerId) {
        const owner = await this.prisma.user.findUnique({
          where: { id: space.ownerId },
          select: USER_SELECT,
        });
        if (owner) {
          // PERSONAL 은 소유자만 canView → 멤버/그룹 무관하게 소유자 1명.
          this.addEntry(map, owner, 'ADMIN', 'owner');
        }
      }
      return { everyone: false, map };
    }

    // PRIVATE: 개인 멤버.
    const members = await this.prisma.spaceMember.findMany({
      where: { spaceId: space.id },
      select: { role: true, user: { select: USER_SELECT } },
    });
    for (const m of members) {
      this.addEntry(map, m.user, m.role, 'personal');
    }

    // PRIVATE: 그룹 부여 → 그룹 멤버를 한 번에 펼침(N+1 없음).
    const grants = await this.prisma.spaceMemberGroup.findMany({
      where: { spaceId: space.id },
      select: { groupId: true, role: true, group: { select: { id: true, name: true } } },
    });
    if (grants.length > 0) {
      const grantByGroup = new Map(
        grants.map((g) => [g.groupId, { role: g.role, group: g.group }]),
      );
      const groupMembers = await this.prisma.groupMember.findMany({
        where: { groupId: { in: grants.map((g) => g.groupId) } },
        select: { groupId: true, user: { select: USER_SELECT } },
      });
      for (const gm of groupMembers) {
        const grant = grantByGroup.get(gm.groupId);
        if (!grant) continue;
        this.addEntry(map, gm.user, grant.role, { group: grant.group });
      }
    }

    return { everyone: false, map };
  }

  // 사용자 단위 합치기 — 역할은 max, via 는 누적.
  private addEntry(
    map: Map<string, SpaceAccessUser>,
    user: UserLite,
    role: SpaceRole,
    via: AccessVia,
  ): void {
    const existing = map.get(user.id);
    if (!existing) {
      map.set(user.id, {
        userId: user.id,
        username: user.username,
        name: user.name,
        department: user.department ?? null,
        role,
        via: [via],
      });
      return;
    }
    existing.role = this.perms.maxSpaceRole(existing.role, role) ?? existing.role;
    existing.via.push(via);
  }

  private sortUsers<T extends { name: string; userId: string }>(arr: T[]): T[] {
    return arr.sort(
      (a, b) => a.name.localeCompare(b.name) || a.userId.localeCompare(b.userId),
    );
  }

  // ─── GET /spaces/:id/effective-access ────────────────────────────────────────
  async spaceEffectiveAccess(
    spaceId: string,
    actor: Actor,
    paging?: Partial<Paging>,
  ): Promise<SpaceEffectiveAccess> {
    // 게이트: 공간 canManage(공간 ADMIN) 또는 전역 ADMIN. 그 외 403. 없는 공간 404.
    const access = await this.perms.assertCanManage(spaceId, actor);
    const space = access.space as SpaceLite;
    const globalAdmins = await this.countGlobalAdmins();

    const { everyone, map } = await this.computeSpaceUsers(space);
    if (everyone) {
      return { everyone: true, globalAdmins: { count: globalAdmins } };
    }

    const all = this.sortUsers([...map.values()]);
    const { limit, offset } = this.normalizePaging(paging);
    return {
      everyone: false,
      users: all.slice(offset, offset + limit),
      total: all.length,
      limit,
      offset,
      globalAdmins: { count: globalAdmins },
    };
  }

  // ─── GET /pages/:id/effective-access ─────────────────────────────────────────
  async pageEffectiveAccess(
    pageId: string,
    actor: Actor,
    paging?: Partial<Paging>,
  ): Promise<PageEffectiveAccess> {
    const page = await this.prisma.page.findFirst({
      where: { id: pageId, deletedAt: null },
      select: {
        id: true,
        spaceId: true,
        authorId: true,
        restrictionMode: true,
      },
    });
    if (!page) throw new NotFoundException({ error: 'page not found' });

    // 게이트: 페이지가 속한 공간의 canManage 또는 전역 ADMIN.
    const access = await this.perms.assertCanManage(page.spaceId, actor);
    const space = access.space as SpaceLite;
    const globalAdmins = await this.countGlobalAdmins();
    const mode = page.restrictionMode as 'NONE' | 'EDIT' | 'VIEW_EDIT';
    const { limit, offset } = this.normalizePaging(paging);

    // NONE/EDIT: 보기 제한 없음 → 공간 접근자가 곧 페이지 접근자.
    //   (EDIT 은 '편집'만 제한 — 보기 집합은 공간과 동일. 편집 narrowing 은 제한 API 참조.)
    if (mode === 'NONE' || mode === 'EDIT') {
      const { everyone, map } = await this.computeSpaceUsers(space);
      if (everyone) {
        return { everyone: true, restrictionMode: mode, globalAdmins: { count: globalAdmins } };
      }
      // 제한 멤버십(EDIT 모드 편집 능력 판정용) 로드.
      const { roleByUser, viaByUser } =
        mode === 'EDIT'
          ? await this.loadRestrictionMembers(page.id)
          : { roleByUser: new Map<string, 'EDIT' | 'VIEW'>(), viaByUser: new Map<string, PageRestrictionVia[]>() };

      const all = this.sortUsers([...map.values()]).map((u) =>
        this.toPageUser(u, page, space, mode, roleByUser, viaByUser),
      );
      return {
        everyone: false,
        restrictionMode: mode,
        users: all.slice(offset, offset + limit),
        total: all.length,
        limit,
        offset,
        globalAdmins: { count: globalAdmins },
      };
    }

    // VIEW_EDIT: 보기 자체가 제한 → 공간 접근자 ∩ 제한 통과자. 항상 좁혀짐(everyone 불가).
    const users = await this.computeViewEditAccess(page, space);
    const all = this.sortUsers(users);
    return {
      everyone: false,
      restrictionMode: mode,
      users: all.slice(offset, offset + limit),
      total: all.length,
      limit,
      offset,
      globalAdmins: { count: globalAdmins },
    };
  }

  // NONE/EDIT 사용자 → 페이지 행으로 변환(보기 집합 = 공간 집합).
  private toPageUser(
    u: SpaceAccessUser,
    page: { authorId: string | null },
    space: SpaceLite,
    mode: 'NONE' | 'EDIT',
    roleByUser: Map<string, 'EDIT' | 'VIEW'>,
    viaByUser: Map<string, PageRestrictionVia[]>,
  ): PageAccessUser {
    const canEditSpace = this.canEditSpace(space.visibility, u.role);
    if (mode === 'NONE') {
      return { ...u, pageRole: canEditSpace ? 'EDIT' : 'VIEW' };
    }
    // EDIT 모드: 편집은 작성자/공간관리자/제한 EDIT 멤버만. 그 외는 보기로 강등.
    const bypass = u.userId === page.authorId || u.role === 'ADMIN';
    const rRole = roleByUser.get(u.userId);
    const canEditPage = canEditSpace && (bypass || rRole === 'EDIT');
    const restrictionVia: PageRestrictionVia[] = [
      ...(u.userId === page.authorId ? (['author'] as const) : []),
      ...(u.role === 'ADMIN' ? (['space-manager'] as const) : []),
      ...(viaByUser.get(u.userId) ?? []),
    ];
    return {
      ...u,
      pageRole: canEditPage ? 'EDIT' : 'VIEW',
      ...(restrictionVia.length > 0 ? { restrictionVia } : {}),
    };
  }

  // 제한 멤버십(개인 PageRestriction ∪ 그룹 PageRestrictionGroup) 로드 — 사용자별 max 역할 + via.
  private async loadRestrictionMembers(pageId: string): Promise<{
    roleByUser: Map<string, 'EDIT' | 'VIEW'>;
    viaByUser: Map<string, PageRestrictionVia[]>;
    userById: Map<string, UserLite>;
  }> {
    const roleByUser = new Map<string, 'EDIT' | 'VIEW'>();
    const viaByUser = new Map<string, PageRestrictionVia[]>();
    const userById = new Map<string, UserLite>();

    const bump = (
      userId: string,
      role: 'EDIT' | 'VIEW',
      via: PageRestrictionVia,
      user?: UserLite,
    ) => {
      const prev = roleByUser.get(userId);
      roleByUser.set(userId, prev === 'EDIT' ? 'EDIT' : role);
      const vias = viaByUser.get(userId) ?? [];
      vias.push(via);
      viaByUser.set(userId, vias);
      if (user) userById.set(userId, user);
    };

    const personal = await this.prisma.pageRestriction.findMany({
      where: { pageId },
      select: { role: true, user: { select: USER_SELECT } },
    });
    for (const p of personal) {
      bump(p.user.id, p.role, 'personal', p.user);
    }

    const grants = await this.prisma.pageRestrictionGroup.findMany({
      where: { pageId },
      select: { groupId: true, role: true, group: { select: { id: true, name: true } } },
    });
    if (grants.length > 0) {
      const grantByGroup = new Map(
        grants.map((g) => [g.groupId, { role: g.role, group: g.group }]),
      );
      const gms = await this.prisma.groupMember.findMany({
        where: { groupId: { in: grants.map((g) => g.groupId) } },
        select: { groupId: true, user: { select: USER_SELECT } },
      });
      for (const gm of gms) {
        const grant = grantByGroup.get(gm.groupId);
        if (!grant) continue;
        bump(gm.user.id, grant.role, { group: grant.group }, gm.user);
      }
    }

    return { roleByUser, viaByUser, userById };
  }

  // VIEW_EDIT — 공간 접근자 ∩ 제한 통과자(작성자/공간관리자/제한 멤버). 전역 ADMIN 제외(별도 count).
  private async computeViewEditAccess(
    page: { id: string; authorId: string | null },
    space: SpaceLite,
  ): Promise<PageAccessUser[]> {
    const { everyone, map: spaceMap } = await this.computeSpaceUsers(space);
    const { roleByUser, viaByUser, userById } = await this.loadRestrictionMembers(
      page.id,
    );

    // 후보 사용자 = 제한 멤버 ∪ 작성자 ∪ 공간 ADMIN 멤버(공간 관리자 bypass).
    const candidates = new Set<string>([...roleByUser.keys()]);

    // 작성자.
    if (page.authorId) {
      candidates.add(page.authorId);
      this.pushVia(viaByUser, page.authorId, 'author');
      if (!userById.has(page.authorId)) {
        const u = await this.prisma.user.findUnique({
          where: { id: page.authorId },
          select: USER_SELECT,
        });
        if (u) userById.set(u.id, u);
      }
    }

    // 공간 ADMIN 멤버(canManage bypass) — PUBLIC 포함 항상 조회.
    const adminMembers = await this.prisma.spaceMember.findMany({
      where: { spaceId: space.id, role: 'ADMIN' },
      select: { user: { select: USER_SELECT } },
    });
    const adminIds = new Set<string>();
    for (const am of adminMembers) {
      adminIds.add(am.user.id);
      candidates.add(am.user.id);
      this.pushVia(viaByUser, am.user.id, 'space-manager');
      if (!userById.has(am.user.id)) userById.set(am.user.id, am.user);
    }

    const out: PageAccessUser[] = [];
    for (const userId of candidates) {
      // 공간 접근 가능 여부(실제 canView 와 일치):
      //   PUBLIC → 누구나. PRIVATE → 공간 접근자만. PERSONAL → 소유자만.
      let accessibleInSpace: boolean;
      let spaceRole: SpaceRole;
      if (everyone) {
        // PUBLIC: 누구나 보기/편집(암묵적 Editor). ADMIN 멤버면 ADMIN.
        accessibleInSpace = true;
        spaceRole = adminIds.has(userId) ? 'ADMIN' : 'EDITOR';
      } else {
        const inSpace = spaceMap.get(userId);
        accessibleInSpace = !!inSpace;
        spaceRole = inSpace?.role ?? 'VIEWER';
      }
      if (!accessibleInSpace) continue;

      const user = userById.get(userId) ?? this.fromSpaceMap(spaceMap, userId);
      if (!user) continue;

      const rRole = roleByUser.get(userId);
      const isAuthor = userId === page.authorId;
      const isManager = adminIds.has(userId);
      const bypass = isAuthor || isManager;
      const canEditSpace = this.canEditSpace(space.visibility, spaceRole);
      const canEditPage = canEditSpace && (bypass || rRole === 'EDIT');

      // 공간 접근 경로(via) — PRIVATE/PERSONAL 은 spaceMap 에서, PUBLIC 은 표기 생략.
      const spaceVia = everyone ? [] : spaceMap.get(userId)?.via ?? [];

      out.push({
        userId,
        username: user.username,
        name: user.name,
        department: user.department ?? null,
        role: spaceRole,
        via: spaceVia,
        pageRole: canEditPage ? 'EDIT' : 'VIEW',
        restrictionVia: viaByUser.get(userId) ?? [],
      });
    }
    return out;
  }

  private pushVia(
    viaByUser: Map<string, PageRestrictionVia[]>,
    userId: string,
    via: PageRestrictionVia,
  ): void {
    const vias = viaByUser.get(userId) ?? [];
    vias.push(via);
    viaByUser.set(userId, vias);
  }

  private fromSpaceMap(
    spaceMap: Map<string, SpaceAccessUser>,
    userId: string,
  ): UserLite | null {
    const e = spaceMap.get(userId);
    return e
      ? { id: e.userId, username: e.username, name: e.name, department: e.department }
      : null;
  }
}
