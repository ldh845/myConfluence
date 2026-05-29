// Cycle 70 — 페이지 작업 상태. null/undefined 면 "상태 없음"(배지 미표시).
export type PageStatus = "TODO" | "IN_PROGRESS" | "DONE";

export type PageNode = {
  id: string;
  title: string;
  parentId: string | null;
  spaceId: string;
  updatedAt: string;
  // Cycle 30 — /spaces "내 공간" 탭 필터용. 레거시 페이지는 null 가능.
  authorId?: string | null;
  // Cycle 35 — 발행 시각. null이면 미발행 draft → Sidebar 페이지 트리에서 숨김.
  // 첫 publish 시 백엔드가 채운다. 백엔드 응답에서 빠져있을 수도 있어 optional.
  publishedAt?: string | null;
  // Cycle 70 — 작업 상태(카드 배지용). 백엔드 select 에 따라 빠질 수 있어 optional.
  status?: PageStatus | null;
};

// Cycle 74 — 스페이스 공개 범위 / 멤버 역할 / 바로가기.
export type SpaceVisibility = "PUBLIC" | "PRIVATE" | "PERSONAL";
export type SpaceRole = "ADMIN" | "EDITOR" | "VIEWER";
export type SpaceShortcutType = "INTERNAL_PAGE" | "EXTERNAL_URL";
export type SpaceShortcut = {
  id: string;
  type: SpaceShortcutType;
  label: string;
  target: string; // pageId(INTERNAL_PAGE) 또는 URL(EXTERNAL_URL)
  position: number;
};

export type SpaceWithPages = {
  id: string;
  name: string;
  description: string | null;
  // Cycle 74-G — 아이콘(이모지 또는 data:image URL).
  icon?: string | null;
  createdAt: string;
  pages: PageNode[];
  // Cycle 33 — 공간의 명시적 홈(메인) 페이지. 없으면(백필 누락/페이지 없음) null.
  homePageId?: string | null;
  // Cycle 32/49 — 공간 유형. PERSONAL 은 백엔드 가드로 ownerId 소유자에게만 노출.
  // SystemSidebar/UserMenu 가 본인 personal space 식별에 사용.
  type?: "SITE" | "PERSONAL";
  ownerId?: string | null;
  // Cycle 74-A — 공개 범위.
  visibility?: SpaceVisibility;
  // Cycle 74-B — 현재 사용자의 멤버 역할(0~1행). '공간 도구' 노출/canManage 판정용.
  members?: { role: SpaceRole }[];
  // Cycle 74-F — 사이드바 바로가기(순서대로).
  shortcuts?: SpaceShortcut[];
};

// FR-001 (Cycle 27c) — 페이지 작성자/마지막 편집자 요약.
export type PageUserSummary = {
  id: string;
  username: string;
  name: string;
  department: string;
  role: "ADMIN" | "PART_LEADER" | "DEVELOPER" | "DESIGNER" | "PM";
};

export type PageFull = {
  id: string;
  title: string;
  content: string;
  draftContent: string | null;
  spaceId: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  // Cycle 35 — null이면 아직 한 번도 발행되지 않은 draft. 편집기 버튼 라벨
  // (첫 발행=발행 / 재발행=업데이트) 분기에 사용.
  publishedAt?: string | null;
  author?: PageUserSummary | null;
  lastEditor?: PageUserSummary | null;
  // Cycle 70 — 작업 상태. findOne 은 scalar 자동 포함이라 항상 옴(상태 없으면 null).
  status?: PageStatus | null;
};
