import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivitiesService } from '../activities/activities.service';
import {
  SpacePermissionService,
  type Actor,
} from './space-permission.service';
import { DepartmentGroupService } from '../department/department-group.service';
import { CreateSpaceDto } from './dto/create-space.dto';

// 사이드바/디렉터리에서 공통으로 쓰는 pages select.
const PAGES_INCLUDE = {
  pages: {
    // FR-024 (Cycle 18-1a) — 휴지통 페이지는 제외.
    where: { deletedAt: null },
    // FR-021 (Cycle 19a) — position 우선 정렬.
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      title: true,
      parentId: true,
      spaceId: true,
      updatedAt: true,
      // Cycle 30 — /spaces "내 공간" 탭 필터용.
      authorId: true,
      // Cycle 35 — Sidebar가 미발행 draft 페이지를 트리에서 숨길 때 사용.
      publishedAt: true,
    },
  },
} satisfies Prisma.SpaceInclude;

// Cycle 74-F — 외부 URL 바로가기 보안: http/https 스킴만 허용(javascript: 등 차단).
function isSafeHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

@Injectable()
export class SpacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activities: ActivitiesService,
    private readonly perms: SpacePermissionService,
    // Cycle L10 (feature/ldh) — 공간 생성 기본 정책(생성자 부서 그룹 EDITOR 부여).
    private readonly deptGroups: DepartmentGroupService,
  ) {}

  // 모든 공간을 반환하되, 각 공간에 현재 사용자의 canView/canEdit 권한을 추가.
  // 권한이 없는 공간도 목록에 보이지만, FE에서 접근 제한 알림을 표시할 수 있다.
  async findAll(actor: Actor) {
    const spaces = await this.prisma.space.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        ...PAGES_INCLUDE,
        // Cycle 74-B — 현재 사용자의 멤버 역할(0~1행). FE 가 '공간 도구' 노출/
        //   canManage 판정에 사용. 비로그인 시 빈 배열.
        ...(actor
          ? { members: { where: { userId: actor.id }, select: { role: true } } }
          : {}),
        // Cycle 74-F — 사이드바 바로가기(순서대로). 멤버 공통.
        shortcuts: { orderBy: { position: 'asc' } },
      },
    });

    // 각 공간에 대해 canView/canEdit 계산
    const enriched = await Promise.all(
      spaces.map(async (space) => {
        const access = await this.perms.loadAccess(space.id, actor?.id ?? null);
        const canView = access ? this.perms.canView(access, actor) : false;
        const canEdit = access ? this.perms.canEdit(access, actor) : false;
        return { ...space, canView, canEdit };
      }),
    );

    return enriched;
  }

  // Cycle 74-B — 공간 도구 '개요' 탭: 이름/설명/아이콘 변경. canManage 가드.
  //   visibility 제거 후 더 이상 공개 범위 변경 불가.
  async updateSettings(
    id: string,
    dto: {
      name?: string;
      description?: string | null;
      icon?: string | null;
    },
    user: Actor,
  ) {
    await this.perms.assertCanManage(id, user);
    const data: Prisma.SpaceUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.icon !== undefined) {
      // Cycle 74-G — 아이콘은 이모지(짧은 문자) 또는 data:image URL 만 허용. 빈 값=제거.
      const icon = dto.icon;
      if (icon && icon.length > 0) {
        const isImage = icon.startsWith('data:image/');
        const isShort = icon.length <= 16;
        if (!isImage && !isShort) {
          throw new BadRequestException({ error: 'invalid icon' });
        }
      }
      data.icon = icon && icon.length > 0 ? icon : null;
    }
    return this.prisma.space.update({
      where: { id },
      data,
      include: PAGES_INCLUDE,
    });
  }

  // Cycle 74-B — 스페이스 삭제. canManage 가드. 페이지/멤버 등은 FK Cascade 로 정리.
  async remove(id: string, user: Actor) {
    await this.perms.assertCanManage(id, user);
    await this.prisma.space.delete({ where: { id } });
    return { ok: true };
  }

  // ─── Cycle 74-C — 스페이스 멤버 관리 ──────────────────────────────────────
  //   모두 canManage 가드. 마지막 ADMIN 강등/제거는 금지(최소 1명 유지).

  async listMembers(id: string, user: Actor) {
    await this.perms.assertCanManage(id, user);
    return this.prisma.spaceMember.findMany({
      where: { spaceId: id },
      orderBy: { createdAt: 'asc' },
      select: {
        userId: true,
        role: true,
        createdAt: true,
        user: {
          select: { id: true, name: true, department: true, email: true },
        },
      },
    });
  }

  async addMember(
    id: string,
    userId: string,
    role: 'ADMIN' | 'EDITOR' | 'VIEWER',
    user: Actor,
  ) {
    await this.perms.assertCanManage(id, user);
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!target) throw new NotFoundException({ error: 'user not found' });
    // 이미 멤버면 역할 갱신(idempotent).
    await this.prisma.spaceMember.upsert({
      where: { spaceId_userId: { spaceId: id, userId } },
      update: { role },
      create: { spaceId: id, userId, role },
    });
    return { ok: true };
  }

  async updateMemberRole(
    id: string,
    userId: string,
    role: 'ADMIN' | 'EDITOR' | 'VIEWER',
    user: Actor,
  ) {
    await this.perms.assertCanManage(id, user);
    const current = await this.prisma.spaceMember.findUnique({
      where: { spaceId_userId: { spaceId: id, userId } },
      select: { role: true },
    });
    if (!current) throw new NotFoundException({ error: 'member not found' });
    // 마지막 ADMIN 강등 방지.
    if (current.role === 'ADMIN' && role !== 'ADMIN') {
      await this.assertNotLastAdmin(id);
    }
    await this.prisma.spaceMember.update({
      where: { spaceId_userId: { spaceId: id, userId } },
      data: { role },
    });
    return { ok: true };
  }

  async removeMember(id: string, userId: string, user: Actor) {
    await this.perms.assertCanManage(id, user);
    const current = await this.prisma.spaceMember.findUnique({
      where: { spaceId_userId: { spaceId: id, userId } },
      select: { role: true },
    });
    if (!current) throw new NotFoundException({ error: 'member not found' });
    // 마지막 ADMIN 제거 방지.
    if (current.role === 'ADMIN') {
      await this.assertNotLastAdmin(id);
    }
    await this.prisma.spaceMember.delete({
      where: { spaceId_userId: { spaceId: id, userId } },
    });
    return { ok: true };
  }

  // ─── Cycle L7 (feature/ldh) — 스페이스 그룹 권한(SpaceMemberGroup) 관리 ──────
  //   모두 canManage 가드. 개인 멤버십과 별개의 부여이며 판정 시 max 결합된다.
  //   ※ 마지막 ADMIN 보호는 개인 SpaceMember 기준만 유지(그룹 ADMIN 은 카운트 안 함) —
  //     공간엔 항상 개인 ADMIN 1명 이상이 보장되므로 그룹 제거로 잠기지 않는다.

  async listMemberGroups(id: string, user: Actor) {
    await this.perms.assertCanManage(id, user);
    return this.prisma.spaceMemberGroup.findMany({
      where: { spaceId: id },
      orderBy: { createdAt: 'asc' },
      select: {
        groupId: true,
        role: true,
        createdAt: true,
        group: {
          select: {
            id: true,
            name: true,
            source: true,
            _count: { select: { members: true } },
          },
        },
      },
    });
  }

  async addMemberGroup(
    id: string,
    groupId: string,
    role: 'ADMIN' | 'EDITOR' | 'VIEWER',
    user: Actor,
  ) {
    await this.perms.assertCanManage(id, user);
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true },
    });
    if (!group) throw new NotFoundException({ error: 'group not found' });
    // 이미 부여돼 있으면 역할 갱신(idempotent).
    await this.prisma.spaceMemberGroup.upsert({
      where: { spaceId_groupId: { spaceId: id, groupId } },
      update: { role },
      create: { spaceId: id, groupId, role },
    });
    return { ok: true };
  }

  async updateMemberGroupRole(
    id: string,
    groupId: string,
    role: 'ADMIN' | 'EDITOR' | 'VIEWER',
    user: Actor,
  ) {
    await this.perms.assertCanManage(id, user);
    const current = await this.prisma.spaceMemberGroup.findUnique({
      where: { spaceId_groupId: { spaceId: id, groupId } },
      select: { groupId: true },
    });
    if (!current) {
      throw new NotFoundException({ error: 'group grant not found' });
    }
    await this.prisma.spaceMemberGroup.update({
      where: { spaceId_groupId: { spaceId: id, groupId } },
      data: { role },
    });
    return { ok: true };
  }

  async removeMemberGroup(id: string, groupId: string, user: Actor) {
    await this.perms.assertCanManage(id, user);
    await this.prisma.spaceMemberGroup.deleteMany({
      where: { spaceId: id, groupId },
    });
    return { ok: true };
  }

  // Cycle 74-D — 감사 로그 탭. canManage 가드 후 ActivityLog 를 스페이스 단위로 필터.
  async getAuditLog(
    id: string,
    opts: {
      type?: string;
      actorId?: string;
      dateFrom?: Date;
      dateTo?: Date;
      limit?: number;
      offset?: number;
    },
    user: Actor,
  ) {
    await this.perms.assertCanManage(id, user);
    return this.activities.list({ spaceId: id, ...opts });
  }

  // ─── Cycle 74-F — 사이드바 바로가기 ───────────────────────────────────────
  async addShortcut(
    id: string,
    dto: {
      type: 'INTERNAL_PAGE' | 'EXTERNAL_URL';
      label: string;
      target: string;
    },
    user: Actor,
  ) {
    await this.perms.assertCanManage(id, user);
    if (dto.type === 'EXTERNAL_URL' && !isSafeHttpUrl(dto.target)) {
      throw new BadRequestException({ error: 'invalid url (http/https only)' });
    }
    if (dto.type === 'INTERNAL_PAGE') {
      const page = await this.prisma.page.findFirst({
        where: { id: dto.target, spaceId: id, deletedAt: null },
        select: { id: true },
      });
      if (!page) {
        throw new BadRequestException({ error: 'page not found in this space' });
      }
    }
    const count = await this.prisma.spaceShortcut.count({
      where: { spaceId: id },
    });
    await this.prisma.spaceShortcut.create({
      data: {
        spaceId: id,
        type: dto.type,
        label: dto.label,
        target: dto.target,
        position: count,
      },
    });
    return { ok: true };
  }

  async updateShortcut(
    id: string,
    shortcutId: string,
    dto: { label?: string; target?: string },
    user: Actor,
  ) {
    await this.perms.assertCanManage(id, user);
    const sc = await this.prisma.spaceShortcut.findFirst({
      where: { id: shortcutId, spaceId: id },
      select: { type: true },
    });
    if (!sc) throw new NotFoundException({ error: 'shortcut not found' });
    if (
      dto.target !== undefined &&
      sc.type === 'EXTERNAL_URL' &&
      !isSafeHttpUrl(dto.target)
    ) {
      throw new BadRequestException({ error: 'invalid url (http/https only)' });
    }
    await this.prisma.spaceShortcut.update({
      where: { id: shortcutId },
      data: {
        ...(dto.label !== undefined ? { label: dto.label } : {}),
        ...(dto.target !== undefined ? { target: dto.target } : {}),
      },
    });
    return { ok: true };
  }

  async removeShortcut(id: string, shortcutId: string, user: Actor) {
    await this.perms.assertCanManage(id, user);
    await this.prisma.spaceShortcut.deleteMany({
      where: { id: shortcutId, spaceId: id },
    });
    return { ok: true };
  }

  // 전체 순서를 ids 배열 순으로 재부여(위/아래 이동도 FE 가 새 순서로 보냄).
  async reorderShortcuts(id: string, ids: string[], user: Actor) {
    await this.perms.assertCanManage(id, user);
    await Promise.all(
      ids.map((sid, i) =>
        this.prisma.spaceShortcut.updateMany({
          where: { id: sid, spaceId: id },
          data: { position: i },
        }),
      ),
    );
    return { ok: true };
  }

  private async assertNotLastAdmin(spaceId: string) {
    const adminCount = await this.prisma.spaceMember.count({
      where: { spaceId, role: 'ADMIN' },
    });
    if (adminCount <= 1) {
      throw new BadRequestException({
        error: 'cannot remove or demote the last space admin',
      });
    }
  }

  // Cycle 33 — 공간 생성 시 홈(메인) 페이지를 자동 생성하고 homePageId로 지정.
  async create(
    dto: CreateSpaceDto,
    actor?: { id: string; name: string } | null,
  ) {
    // Cycle 80 — 스페이스 키 정규화(대문자) + 중복 검사. 빈 값이면 null.
    const key = dto.key?.trim().toUpperCase() || null;
    if (key) {
      const dup = await this.prisma.space.findFirst({
        where: { key },
        select: { id: true },
      });
      if (dup) {
        throw new BadRequestException({ error: 'space key already in use' });
      }
    }
    const result = await this.prisma.$transaction(async (tx) => {
      const space = await tx.space.create({
        data: {
          name: dto.name,
          description: dto.description ?? null,
          key,
          // visibility 제거 후: 새 공간은 PRIVATE(멤버/그룹 기반 접근 제어)
          visibility: 'PRIVATE',
        },
      });
      const homePage = await tx.page.create({
        data: {
          // Cycle 33 — 공간 홈 페이지 제목은 "Main Page"로 고정.
          title: 'Main Page',
          content: `# ${space.name}\n\n이 공간의 홈 페이지입니다. 자유롭게 편집하세요.`,
          spaceId: space.id,
          parentId: null,
          position: 0,
          authorId: actor?.id ?? null,
          lastEditorId: actor?.id ?? null,
          // Cycle 35 — 자동 생성된 홈은 즉시 발행(트리/홈 진입 가능).
          publishedAt: new Date(),
        },
      });
      // Cycle 74-A — 공간 생성자를 자동으로 Space Admin 멤버로 등록.
      if (actor?.id) {
        await tx.spaceMember.create({
          data: { spaceId: space.id, userId: actor.id, role: 'ADMIN' },
        });
      }
      const updated = await tx.space.update({
        where: { id: space.id },
        data: { homePageId: homePage.id },
        include: PAGES_INCLUDE,
      });
      return { space: updated, homePage };
    });

    // 홈 페이지 생성 활동 로그 (best-effort).
    await this.activities.log({
      type: 'page.created',
      spaceId: result.space.id,
      pageId: result.homePage.id,
      actorId: actor?.id ?? null,
      actorName: actor?.name ?? null,
      payload: { title: result.homePage.title },
    });

    // Cycle L10 — 공간 생성 기본 정책: 생성자 부서 그룹을 EDITOR 로 자동 부여.
    //   기본 true. best-effort(부서 그룹 부여 실패가 공간 생성을 무효화하지 않게).
    if (dto.applyDepartmentDefault !== false && actor?.id) {
      await this.applyDepartmentDefaultGrant(result.space.id, actor.id);
    }

    return result.space;
  }

  // Cycle L10 (feature/ldh) — 생성자의 부서 그룹을 공간에 EDITOR 로 부여(idempotent).
  //   생성자 department 가 없으면 무동작. 생성자는 별도로 이미 공간 ADMIN 멤버.
  private async applyDepartmentDefaultGrant(
    spaceId: string,
    creatorId: string,
  ): Promise<void> {
    try {
      const creator = await this.prisma.user.findUnique({
        where: { id: creatorId },
        select: { department: true },
      });
      const department = creator?.department?.trim();
      if (!department) return;
      const group = await this.deptGroups.resolveOrCreateDepartmentGroup(department);
      if (!group) return;
      await this.prisma.spaceMemberGroup.upsert({
        where: { spaceId_groupId: { spaceId, groupId: group.id } },
        update: {},
        create: { spaceId, groupId: group.id, role: 'EDITOR' },
      });
    } catch {
      // best-effort — 공간은 이미 생성됨. 부서 그룹 부여 실패는 무시(수동 부여 가능).
    }
  }

  // Cycle 33 — 공간의 홈 페이지 지정. homePageId 페이지가 그 공간 소속이어야 함.
  // Cycle L5-2 정책 12 — 공간 관리 권한(assertCanManage) 필수. 무권한 변경 구멍 폐쇄.
  async setHomePage(spaceId: string, homePageId: string, user: Actor) {
    await this.perms.assertCanManage(spaceId, user);
    const space = await this.prisma.space.findUnique({
      where: { id: spaceId },
      select: { id: true },
    });
    if (!space) throw new NotFoundException({ error: 'space not found' });

    const page = await this.prisma.page.findFirst({
      where: { id: homePageId, deletedAt: null },
      select: { id: true, spaceId: true },
    });
    if (!page) throw new NotFoundException({ error: 'page not found' });
    if (page.spaceId !== spaceId) {
      throw new BadRequestException({
        error: 'home page must belong to this space',
      });
    }

    return this.prisma.space.update({
      where: { id: spaceId },
      data: { homePageId },
      include: PAGES_INCLUDE,
    });
  }

  // Cycle 32 — 사용자의 개인 공간 lazy 생성. 없으면 만들고, 있으면 그대로 반환.
  // Cycle 33 — 새로 만들 때 홈 페이지도 함께 생성.
  async getOrCreatePersonal(user: { id: string; name: string }) {
    const existing = await this.prisma.space.findFirst({
      where: { type: 'PERSONAL', ownerId: user.id },
      include: PAGES_INCLUDE,
    });
    if (existing) {
      // Cycle 75 — 개인 공간 소유자를 SpaceMember(ADMIN) 로 보장(권한 탭 표시).
      //   매 로그인 호출이라 기존 개인 공간도 자연 백필됨(idempotent upsert).
      await this.prisma.spaceMember.upsert({
        where: { spaceId_userId: { spaceId: existing.id, userId: user.id } },
        update: {},
        create: { spaceId: existing.id, userId: user.id, role: 'ADMIN' },
      });
      return existing;
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const space = await tx.space.create({
        data: {
          name: `${user.name}의 개인 공간`,
          description: '개인 작업 공간',
          type: 'PERSONAL',
          visibility: 'PERSONAL',
          ownerId: user.id,
        },
      });
      // Cycle 75 — 개인 공간 소유자를 ADMIN 멤버로 부트스트랩(SITE create 와 동일).
      await tx.spaceMember.create({
        data: { spaceId: space.id, userId: user.id, role: 'ADMIN' },
      });
      const homePage = await tx.page.create({
        data: {
          // Cycle 33 — 홈 페이지 제목은 "Main Page"로 고정.
          title: 'Main Page',
          content: `# ${space.name}\n\n개인 작업 공간의 홈 페이지입니다.`,
          spaceId: space.id,
          parentId: null,
          position: 0,
          authorId: user.id,
          lastEditorId: user.id,
          // Cycle 35 — 자동 생성된 개인 공간 홈도 즉시 발행 상태.
          publishedAt: new Date(),
        },
      });
      return tx.space.update({
        where: { id: space.id },
        data: { homePageId: homePage.id },
        include: PAGES_INCLUDE,
      });
    });
    return result;
  }
}