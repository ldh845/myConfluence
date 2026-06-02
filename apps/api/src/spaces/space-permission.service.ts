import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SpaceRole, SpaceVisibility } from '@prisma/client';
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
    }
    return { space, role };
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
    const m = await this.prisma.pageRestriction.findUnique({
      where: { pageId_userId: { pageId, userId: user.id } },
      select: { role: true },
    });
    if (!m || m.role !== 'EDIT') {
      throw new ForbiddenException({ error: 'page restricted' });
    }
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
    const m = await this.prisma.pageRestriction.findUnique({
      where: { pageId_userId: { pageId: page.id, userId: user.id } },
      select: { role: true },
    });
    if (!m) throw new ForbiddenException({ error: 'page restricted' });
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
