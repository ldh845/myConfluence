import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Cycle L6 (feature/ldh) — 그룹(부서/팀) 관리 서비스. 전역 ADMIN 전용(컨트롤러 가드).
//   이 사이클은 '그릇'만 — 권한 판정 로직에는 영향 없음(L7 에서 공간 권한에 결합).
//   source=KEYCLOAK 그룹은 수정·삭제·멤버 편집을 모두 거부(L8 동기화 그룹 보호 선반영).
//   현재 생성은 전부 LOCAL 이라 실사용 영향 없음.

const MEMBER_USER_SELECT = {
  id: true,
  username: true,
  name: true,
  department: true,
  email: true,
} as const;

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  // 목록 — 멤버 수 포함. source 배지·정렬은 FE.
  async list() {
    const groups = await this.prisma.group.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { members: true } } },
    });
    return groups.map(({ _count, ...g }) => ({
      ...g,
      memberCount: _count.members,
    }));
  }

  // 생성 — name 중복 409. 항상 source=LOCAL(기본값).
  async create(input: { name: string; description?: string }) {
    const name = input.name.trim();
    const existing = await this.prisma.group.findUnique({ where: { name } });
    if (existing) {
      throw new ConflictException({
        error: 'group name taken',
        message: '이미 같은 이름의 그룹이 있습니다.',
      });
    }
    return this.prisma.group.create({
      data: { name, description: input.description?.trim() || null },
    });
  }

  // 수정 — KEYCLOAK 그룹은 403. name 변경 시 중복 409.
  async update(
    id: string,
    patch: { name?: string; description?: string },
  ) {
    const group = await this.loadLocal(id);
    const data: Prisma.GroupUpdateInput = {};
    if (patch.name !== undefined) {
      const name = patch.name.trim();
      if (name !== group.name) {
        const dup = await this.prisma.group.findUnique({ where: { name } });
        if (dup) {
          throw new ConflictException({
            error: 'group name taken',
            message: '이미 같은 이름의 그룹이 있습니다.',
          });
        }
      }
      data.name = name;
    }
    if (patch.description !== undefined) {
      data.description = patch.description.trim() || null;
    }
    return this.prisma.group.update({ where: { id }, data });
  }

  // 삭제 — KEYCLOAK 그룹은 403. 멤버십은 FK Cascade 로 함께 정리.
  async remove(id: string): Promise<{ ok: true }> {
    await this.loadLocal(id);
    await this.prisma.group.delete({ where: { id } });
    return { ok: true };
  }

  // 멤버 목록.
  async listMembers(id: string) {
    await this.loadGroup(id);
    const members = await this.prisma.groupMember.findMany({
      where: { groupId: id },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true, user: { select: MEMBER_USER_SELECT } },
    });
    return members.map((m) => ({ ...m.user, joinedAt: m.createdAt }));
  }

  // 멤버 추가 — KEYCLOAK 그룹 403, 대상 사용자 없으면 404.
  //   중복 추가는 idempotent(upsert) — 이미 멤버면 무해하게 통과(409 대신).
  async addMember(
    id: string,
    userId: string,
  ): Promise<{ ok: true; alreadyMember: boolean }> {
    await this.loadLocal(id);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException({ error: 'user not found' });
    const existing = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId } },
      select: { groupId: true },
    });
    if (existing) return { ok: true, alreadyMember: true };
    await this.prisma.groupMember.create({ data: { groupId: id, userId } });
    return { ok: true, alreadyMember: false };
  }

  // 멤버 제거 — KEYCLOAK 그룹 403. 멤버가 아니어도 무해(deleteMany).
  async removeMember(id: string, userId: string): Promise<{ ok: true }> {
    await this.loadLocal(id);
    await this.prisma.groupMember.deleteMany({ where: { groupId: id, userId } });
    return { ok: true };
  }

  // 그룹 로드(없으면 404).
  private async loadGroup(id: string) {
    const group = await this.prisma.group.findUnique({ where: { id } });
    if (!group) throw new NotFoundException({ error: 'group not found' });
    return group;
  }

  // 그룹 로드 + LOCAL 강제(KEYCLOAK 이면 403). 수정·삭제·멤버 편집 진입점.
  private async loadLocal(id: string) {
    const group = await this.loadGroup(id);
    if (group.source === 'KEYCLOAK') {
      throw new ForbiddenException({
        error: 'keycloak group is read-only',
        message: 'Keycloak 에서 동기화된 그룹은 DocSpace 에서 수정할 수 없습니다.',
      });
    }
    return group;
  }
}
