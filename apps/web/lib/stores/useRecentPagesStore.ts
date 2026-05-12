import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// FR-130 (Cycle 22) — 최근 방문한 페이지 기록.
// localStorage persist (브라우저별 분리). 인증 도입 시 user id 기반으로 마이그레이션.
// MAX 20개. 동일 페이지 재방문 시 중복 제거 + 최신으로 이동.

const MAX_ENTRIES = 20;

export type RecentEntry = {
  pageId: string;
  visitedAt: string; // ISO
};

type RecentPagesState = {
  entries: RecentEntry[];
  record: (pageId: string) => void;
  remove: (pageId: string) => void;
  clear: () => void;
};

export const useRecentPagesStore = create<RecentPagesState>()(
  persist(
    (set) => ({
      entries: [],
      record: (pageId) =>
        set((s) => {
          const next = s.entries.filter((e) => e.pageId !== pageId);
          next.unshift({ pageId, visitedAt: new Date().toISOString() });
          if (next.length > MAX_ENTRIES) next.length = MAX_ENTRIES;
          return { entries: next };
        }),
      remove: (pageId) =>
        set((s) => ({ entries: s.entries.filter((e) => e.pageId !== pageId) })),
      clear: () => set({ entries: [] }),
    }),
    {
      name: "docspace-recent-pages",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
