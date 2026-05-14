export type PageNode = {
  id: string;
  title: string;
  parentId: string | null;
  spaceId: string;
  updatedAt: string;
  // Cycle 30 — /spaces "내 공간" 탭 필터용. 레거시 페이지는 null 가능.
  authorId?: string | null;
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
  author?: PageUserSummary | null;
  lastEditor?: PageUserSummary | null;
};
