import type { PageNode, SpaceWithPages } from "@/lib/types";

// Cycle 32/33 — 공간의 '홈/메인 페이지'. 공간에 접속하면 이 페이지가 뜬다.
// 우선순위:
//   1. Space.homePageId (Cycle 33 — 명시적 지정, 공간 생성 시 자동 생성)
//   2. 첫 root 페이지 (백필 누락 / 구버전 데이터 fallback)
//   3. 첫 페이지 (이론상 fallback)
export function getSpaceHomePage(
  space: SpaceWithPages | null | undefined,
): PageNode | null {
  if (!space) return null;
  if (space.homePageId) {
    const explicit = space.pages.find((p) => p.id === space.homePageId);
    if (explicit) return explicit;
  }
  return (
    space.pages.find((p) => p.parentId === null) ?? space.pages[0] ?? null
  );
}

export function getSpaceHomePageId(
  space: SpaceWithPages | null | undefined,
): string | null {
  return getSpaceHomePage(space)?.id ?? null;
}
