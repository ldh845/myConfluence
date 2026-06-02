import type { SpaceWithPages } from "@/lib/types";

// Cycle 74-B — FE 용 canManage 판정(공간 도구 노출/접근 게이팅). 백엔드가 최종 검증.
//   전역 ADMIN override / PERSONAL=소유자 / 그 외=내 멤버 역할 ADMIN.
type CurrentUser = { id: string; role: string } | null | undefined;

export function canManageSpace(
  space: Pick<SpaceWithPages, "type" | "ownerId" | "members"> | null | undefined,
  user: CurrentUser,
): boolean {
  if (!space || !user) return false;
  if (user.role === "ADMIN") return true;
  if (space.type === "PERSONAL") return space.ownerId === user.id;
  return space.members?.[0]?.role === "ADMIN";
}
