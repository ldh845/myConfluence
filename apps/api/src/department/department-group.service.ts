import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Cycle L10 (feature/ldh) — 부서(User.department) 기준 자동 그룹 배정의 단일 출처.
//   로그인 시 멤버십 동기화(AuthService)와 공간 생성 기본 정책(SpacesService)이 공유.
//   부서 그룹 해석 규칙(일관):
//     1) DepartmentGroupMapping[부서명] 이 있으면 그 그룹.
//     2) 없으면 동명 그룹을 찾고, 그래도 없으면 source=DEPARTMENT 로 생성.
//   L8(Keycloak claim) 과의 관계: 부서가 그룹 claim 으로 들어오면 L8 이 KEYCLOAK 그룹을
//   만들어 멤버십을 관리한다. L10 은 그 경우 폴백으로 '스킵'(KEYCLOAK 그룹 멤버십을
//   건드리지 않음) — 속성(department)으로만 들어올 때만 DEPARTMENT 그룹을 관리한다.

export type ResolvedGroup = { id: string; source: 'LOCAL' | 'KEYCLOAK' | 'DEPARTMENT' };

@Injectable()
export class DepartmentGroupService {
  private readonly logger = new Logger(DepartmentGroupService.name);

  constructor(private readonly prisma: PrismaService) {}

  // 부서명 → 대상 그룹 해석(없으면 DEPARTMENT 로 생성). 부서명이 비면 null.
  async resolveOrCreateDepartmentGroup(
    department: string,
  ): Promise<ResolvedGroup | null> {
    const name = department.trim();
    if (!name) return null;

    const mapping = await this.prisma.departmentGroupMapping.findUnique({
      where: { department: name },
      select: { group: { select: { id: true, source: true } } },
    });
    if (mapping?.group) return mapping.group;

    const existing = await this.prisma.group.findUnique({
      where: { name },
      select: { id: true, source: true },
    });
    if (existing) return existing;

    // 동시 로그인 경쟁으로 unique 충돌 시: 재조회로 복구(best-effort).
    try {
      return await this.prisma.group.create({
        data: { name, source: 'DEPARTMENT' },
        select: { id: true, source: true },
      });
    } catch {
      const again = await this.prisma.group.findUnique({
        where: { name },
        select: { id: true, source: true },
      });
      return again ?? null;
    }
  }

  // 로그인 시 사용자의 DEPARTMENT 그룹 멤버십을 현 부서 하나로 정렬한다.
  //   - 부서명 없음(null/undefined/'') → 스킵(기존 멤버십 보존).
  //   - 현 부서 그룹이 DEPARTMENT source 면 멤버십 보장(idempotent).
  //   - 동명 그룹이 LOCAL 이면 스킵 + 경고(불가침), KEYCLOAK 이면 L8 폴백으로 스킵.
  //   - 현 부서가 아닌 DEPARTMENT 멤버십은 제거(부서 변경 대응). LOCAL/KEYCLOAK 불가침.
  async syncUserDepartmentGroup(
    userId: string,
    department: string | null | undefined,
  ): Promise<void> {
    if (!department || !department.trim()) return; // 부서 없음 → 스킵(보존)
    const name = department.trim();

    let keepGroupId: string | null = null;
    const target = await this.resolveOrCreateDepartmentGroup(name);
    if (target) {
      if (target.source === 'DEPARTMENT') {
        await this.prisma.groupMember.upsert({
          where: { groupId_userId: { groupId: target.id, userId } },
          update: {},
          create: { groupId: target.id, userId },
        });
        keepGroupId = target.id;
      } else if (target.source === 'LOCAL') {
        this.logger.warn(
          `부서 '${name}' 자동 배정 스킵 — 동명 LOCAL 그룹 존재(보호).`,
        );
      }
      // KEYCLOAK: L8 claim 이 멤버십 관리 → L10 은 폴백으로 스킵.
    }

    // 현 부서(keepGroupId)가 아닌 DEPARTMENT 멤버십 정리. LOCAL/KEYCLOAK 는 제외(불가침).
    const deptMemberships = await this.prisma.groupMember.findMany({
      where: { userId, group: { source: 'DEPARTMENT' } },
      select: { groupId: true },
    });
    const toRemove = deptMemberships
      .map((m) => m.groupId)
      .filter((id) => id !== keepGroupId);
    if (toRemove.length > 0) {
      await this.prisma.groupMember.deleteMany({
        where: { userId, groupId: { in: toRemove } },
      });
    }
  }
}
