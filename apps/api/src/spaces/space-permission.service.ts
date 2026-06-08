import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PageRestrictionRole,
  Prisma,
  SpaceRole,
  SpaceVisibility,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Cycle 74-A — 스페이스 단위 권한 판정의 단일 출처.
//   정책:
//   - 전역 ADMIN(Cycle 48 User.role): 모든 스페이스에 대해 override(전권).
//   - PUBLIC: 읽기=누구나(앱 미들웨어가 로그인 강제), 편집=로그인 사용자(암묵적 Editor),
//             관리=Space Admin 또는 전역 ADMIN.
//   - PRIVATE: 읽기=멤버, 편집=멤버 role>=EDITOR, 관리=멤버 role=ADMIN.
//   - PERSONAL: 읽기/편집/관리=소유자(ownerId)만.

export type Actor = { id: string; role: string } | null;

export type SpaceAccess = {
  space: { id: string; visibility: SpaceVisibility; ownerId: string | null };
  role: SpaceRole | null;
};

@Injectable()
export class SpacePermissionService {
  constructor(private readonly prisma: PrismaService) {}

  private isGlobalAdmin(user: Actor): boolean {
    return !!user && user.role === 'ADMIN';
  }

  async loadAccess(
    spaceId: string,
    userId: string | null,
  ): Promise<SpaceAccess | null> {
    const space = await this.prisma.space.findUnique({
      where: { id: spaceId },
      select: { id: true, visibility: true, ownerId: true },
    });
    if (!space) return null;
    let role: SpaceRole | null = null;
    if (userId) {
      const m = await this.prisma.spaceMember.findUnique({
        where: { spaceId_userId: { spaceId, userId } },
        select: { role: true },
      });
      role = m?.role ?? null;
      // Cycle L7 (feature/ldh) — 개인 멤버십 역할에 더해, 사용자가 속한 그룹들 중
      //   이 공간에 권한이 부여된 그룹의 역할도 합산한다. 유효 역할 = max(개인, 그룹들).
      //   그룹은 역할을 '올려주기만' 한다(deny 없음) → 개인 권한이 더 높으면 그대로 유지.
      //   소속 그룹 ∩ 공간 부여 그룹을 단일 findMany 로 조회(N+1 없음).
      const grants = await this.prisma.spaceMemberGroup.findMany({
        where: { spaceId, group: { members: { some: { userId } } } },
        select: { role: true },
      });
      for (const g of grants) role = this.higherRole(role, g.role);
    }
    return { space, role };
  }

  // Cycle L7 — 역할 등급(ADMIN > EDITOR > VIEWER > 없음). 개인·그룹 역할 max 결합용.
  private roleRank(role: SpaceRole | null): number {
    switch (role) {
      case 'ADMIN':
        return 3;
      case 'EDITOR':
        return 2;
      case 'VIEWER':
        return 1;
      default:
        return 0;
    }
  }

  // 두 역할 중 더 높은 쪽을 반환(동급이면 a). null 은 '권한 없음'으로 최하위.
  private higherRole(
    a: SpaceRole | null,
    b: SpaceRole | null,
  ): SpaceRole | null {
    return this.roleRank(b) > this.roleRank(a) ? b : a;
  }

  canView(access: SpaceAccess, user: Actor): boolean {
    if (this.isGlobalAdmin(user)) return true;
    switch (access.space.visibility) {
      case 'PUBLIC':
        return true;
      case 'PRIVATE':
        return access.role !== null;
      case 'PERSONAL':
        return !!user && access.space.ownerId === user.id;
      default:
        return false;
    }
  }

  canEdit(access: SpaceAccess, user: Actor): boolean {
    if (this.isGlobalAdmin(user)) return true;
    if (!user) return false;
    switch (access.space.visibility) {
      case 'PUBLIC':
        return true;
      case 'PRIVATE':
        return access.role === 'ADMIN' || access.role === 'EDITOR';
      case 'PERSONAL':
        return access.space.ownerId === user.id;
      default:
        return false;
    }
  }

  canManage(access: SpaceAccess, user: Actor): boolean {
    if (this.isGlobalAdmin(user)) return true;
    if (!user) return false;
    if (access.space.visibility === 'PERSONAL') {
      return access.space.ownerId === user.id;
    }
    return access.role === 'ADMIN';
  }

  async assertCanView(spaceId: string, user: Actor): Promise<SpaceAccess> {
    const a = await this.loadAccess(spaceId, user?.id ?? null);
    if (!a) throw new NotFoundException({ error: 'space not found' });
    if (!this.canView(a, user)) {
      throw new ForbiddenException({ error: 'forbidden' });
    }
    return a;
  }

  async assertCanEdit(spaceId: string, user: Actor): Promise<SpaceAccess> {
    const a = await this.loadAccess(spaceId, user?.id ?? null);
    if (!a) throw new NotFoundException({ error: 'space not found' });
    if (!this.canEdit(a, user)) {
      throw new ForbiddenException({ error: 'forbidden' });
    }
    return a;
  }

  // pageId 로부터 스페이스를 찾아 편집 권한 assert (휴지통 페이지도 대상 — restore 등).
  // Cycle 83 — 페이지 단위 제한(EDIT/VIEW_EDIT)도 함께 확인. 작성자/공간 관리자/전역 ADMIN
  //   은 항상 통과. 그 외는 PageRestriction 에 role=EDIT 으로 등록된 사용자만 통과.
  async assertCanEditPage(pageId: string, user: Actor): Promise<void> {
    const page = await this.prisma.page.findUnique({
      where: { id: pageId },
      select: { spaceId: true, authorId: true, restrictionMode: true },
    });
    if (!page) throw new NotFoundException({ error: 'page not found' });
    const a = await this.assertCanEdit(page.spaceId, user);
    if (page.restrictionMode === 'NONE') return;
    if (this.isGlobalAdmin(user)) return;
    if (user && page.authorId === user.id) return;
    if (this.canManage(a, user)) return;
    if (!user) throw new ForbiddenException({ error: 'page restricted' });
    // Cycle L7-2 (feature/ldh) — 개인 ∪ 소속 그룹 제한 멤버십의 max 역할. EDIT 만 통과.
    const role = await this.effectivePageRestrictionRole(pageId, user.id);
    if (role !== 'EDIT') {
      throw new ForbiddenException({ error: 'page restricted' });
    }
  }

  // Cycle L7-2 (feature/ldh) — 페이지 제한 유효 역할 = max(개인 PageRestriction,
  //   소속 그룹 PageRestrictionGroup 들). deny 없음 — 그룹은 멤버십을 더하고 역할을
  //   올리기만 한다. 둘 다 없으면 null(= 제한 멤버 아님). EDIT > VIEW.
  //   개인이 이미 EDIT 면 그룹 조회를 생략(최댓값 확정). 그룹 조회는 사용자 소속 그룹을
  //   통한 단일 findMany 로 N+1 없음 — L7 loadAccess 의 그룹 멤버십 패턴과 동일.
  private async effectivePageRestrictionRole(
    pageId: string,
    userId: string,
  ): Promise<PageRestrictionRole | null> {
    const personal = await this.prisma.pageRestriction.findUnique({
      where: { pageId_userId: { pageId, userId } },
      select: { role: true },
    });
    let role: PageRestrictionRole | null = personal?.role ?? null;
    if (role === 'EDIT') return role;
    const groups = await this.prisma.pageRestrictionGroup.findMany({
      where: { pageId, group: { members: { some: { userId } } } },
      select: { role: true },
    });
    for (const g of groups) {
      role = this.higherRestrictionRole(role, g.role);
      if (role === 'EDIT') break;
    }
    return role;
  }

  // 두 제한 역할 중 더 높은 쪽(EDIT > VIEW > null). null 은 '멤버 아님'으로 최하위.
  private higherRestrictionRole(
    a: PageRestrictionRole | null,
    b: PageRestrictionRole | null,
  ): PageRestrictionRole | null {
    const rank = (r: PageRestrictionRole | null): number =>
      r === 'EDIT' ? 2 : r === 'VIEW' ? 1 : 0;
    return rank(b) > rank(a) ? b : a;
  }

  // Cycle 83 — VIEW_EDIT 모드 페이지 보기 가드. (NONE/EDIT 은 공간 권한만)
  async assertCanViewPageRestriction(
    page: { id: string; spaceId: string; authorId: string | null; restrictionMode: string },
    user: Actor,
    spaceAccess: SpaceAccess,
  ): Promise<void> {
    if (page.restrictionMode !== 'VIEW_EDIT') return;
    if (this.isGlobalAdmin(user)) return;
    if (user && page.authorId === user.id) return;
    if (this.canManage(spaceAccess, user)) return;
    if (!user) throw new ForbiddenException({ error: 'page restricted' });
    // Cycle L7-2 (feature/ldh) — 개인 ∪ 소속 그룹 제한 멤버십. 역할 무관 멤버이면 보기 통과.
    const role = await this.effectivePageRestrictionRole(page.id, user.id);
    if (role === null) throw new ForbiddenException({ error: 'page restricted' });
  }

  // Cycle L5 (feature/ldh) — pageId 로부터 스페이스 + 페이지 제한을 묶어 읽기 권한 assert.
  //   기존 assertCanEditPage 의 '읽기판'. 첨부/다이어그램/버전/댓글/리액션 등 pageId 로
  //   키되는 읽기 엔드포인트가 공통으로 사용해 비공개·개인 공간·VIEW_EDIT 제한 페이지의
  //   부속 데이터(첨부·다이어그램·버전·댓글·리액션) 누수를 차단한다.
  //   PUBLIC 공간이면 누구나 통과(기존 본문 읽기와 동일 정책) → 공개 흐름 무변화.
  async assertCanViewPage(pageId: string, user: Actor): Promise<void> {
    const page = await this.prisma.page.findUnique({
      where: { id: pageId },
      select: {
        id: true,
        spaceId: true,
        authorId: true,
        restrictionMode: true,
      },
    });
    if (!page) throw new NotFoundException({ error: 'page not found' });
    const access = await this.assertCanView(page.spaceId, user);
    await this.assertCanViewPageRestriction(page, user, access);
  }

  // Cycle 83 — 페이지 제한 관리 권한(작성자/공간 관리자/전역 ADMIN).
  async canManagePageRestriction(pageId: string, user: Actor): Promise<boolean> {
    if (!user) return false;
    if (this.isGlobalAdmin(user)) return true;
    const page = await this.prisma.page.findUnique({
      where: { id: pageId },
      select: { spaceId: true, authorId: true },
    });
    if (!page) return false;
    if (page.authorId === user.id) return true;
    const a = await this.loadAccess(page.spaceId, user.id);
    return a ? this.canManage(a, user) : false;
  }

  async assertCanManagePageRestriction(
    pageId: string,
    user: Actor,
  ): Promise<void> {
    if (!(await this.canManagePageRestriction(pageId, user))) {
      throw new ForbiddenException({ error: 'forbidden' });
    }
  }

  async assertCanManage(spaceId: string, user: Actor): Promise<SpaceAccess> {
    const a = await this.loadAccess(spaceId, user?.id ?? null);
    if (!a) throw new NotFoundException({ error: 'space not found' });
    if (!this.canManage(a, user)) {
      throw new ForbiddenException({ error: 'forbidden' });
    }
    return a;
  }

  // 접근 가능한 스페이스 OR 조건(Space WHERE). 전역 ADMIN 은 {}(제한 없음).
  private accessibleSpaceOr(user: Actor): Prisma.SpaceWhereInput {
    const ors: Prisma.SpaceWhereInput[] = [{ visibility: 'PUBLIC' }];
    if (user) {
      ors.push({
        visibility: 'PRIVATE',
        members: { some: { userId: user.id } },
      });
      // Cycle L7 (feature/ldh) — 소속 그룹을 통해 권한을 받은 비공개 공간도 목록에
      //   노출(접근 가능과 일관). 개인 멤버십과 별개의 OR 가지로만 추가 → 기존 가시성
      //   조건을 약화하지 않는다(없던 접근만 더해짐).
      ors.push({
        visibility: 'PRIVATE',
        memberGroups: { some: { group: { members: { some: { userId: user.id } } } } },
      });
      ors.push({ visibility: 'PERSONAL', ownerId: user.id });
    }
    return { OR: ors };
  }

  // 스페이스 목록 가시성 필터(Space WHERE).
  spaceVisibilityWhere(user: Actor): Prisma.SpaceWhereInput {
    if (this.isGlobalAdmin(user)) return {};
    return this.accessibleSpaceOr(user);
  }

  // 페이지 목록 가시성 필터(Page WHERE) — 접근 가능한 스페이스의 페이지만.
  pageVisibilityWhere(user: Actor): Prisma.PageWhereInput {
    if (this.isGlobalAdmin(user)) return {};
    return { space: this.accessibleSpaceOr(user) };
  }
}
