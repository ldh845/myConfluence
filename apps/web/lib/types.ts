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
};

export type SpaceWithPages = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  pages: PageNode[];
  // Cycle 33 — 공간의 명시적 홈(메인) 페이지. 없으면(백필 누락/페이지 없음) null.
  homePageId?: string | null;
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
};
