export type PageNode = {
  id: string;
  title: string;
  parentId: string | null;
  spaceId: string;
  updatedAt: string;
};

export type SpaceWithPages = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  pages: PageNode[];
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
