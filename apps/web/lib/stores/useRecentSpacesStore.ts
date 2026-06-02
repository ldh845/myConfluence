import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// Cycle 29 — 최근에 사용한 공간 기록.
// localStorage persist. MAX 10개. 동일 공간 재진입 시 중복 제거 + 최신으로 이동.
// TopNav 공간 드롭다운의 "최근에 사용한 공간" 목록에 사용.

const MAX_ENTRIES = 10;

export type RecentSpaceEntry = {
  spaceId: string;
  visitedAt: string; // ISO
};

type RecentSpacesState = {
  entries: RecentSpaceEntry[];
  record: (spaceId: string) => void;
  remove: (spaceId: string) => void;
  clear: () => void;
};

export const useRecentSpacesStore = create<RecentSpacesState>()(
  persist(
    (set) => ({
      entries: [],
      record: (spaceId) =>
        set((s) => {
          const next = s.entries.filter((e) => e.spaceId !== spaceId);
          next.unshift({ spaceId, visitedAt: new Date().toISOString() });
          if (next.length > MAX_ENTRIES) next.length = MAX_ENTRIES;
          return { entries: next };
        }),
      remove: (spaceId) =>
        set((s) => ({
          entries: s.entries.filter((e) => e.spaceId !== spaceId),
        })),
      clear: () => set({ entries: [] }),
    }),
    {
      name: "docspace-recent-spaces",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
