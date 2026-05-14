import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// Cycle 29 (별표) — Confluence "Starred spaces" 패턴.
// 별표가 표시된 스페이스만 "내 공간"으로 노출. localStorage persist.
// orphan id는 spaces 데이터 join 시 자연스럽게 누락된다.

type StarredSpacesState = {
  ids: string[];
  isStarred: (spaceId: string) => boolean;
  toggle: (spaceId: string) => void;
  remove: (spaceId: string) => void;
};

export const useStarredSpacesStore = create<StarredSpacesState>()(
  persist(
    (set, get) => ({
      ids: [],
      isStarred: (spaceId) => get().ids.includes(spaceId),
      toggle: (spaceId) =>
        set((s) => ({
          ids: s.ids.includes(spaceId)
            ? s.ids.filter((x) => x !== spaceId)
            : [...s.ids, spaceId],
        })),
      remove: (spaceId) =>
        set((s) => ({ ids: s.ids.filter((x) => x !== spaceId) })),
    }),
    {
      name: "docspace-starred-spaces",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
