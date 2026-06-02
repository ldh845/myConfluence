import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// FR-025 (Cycle 18-2) — 페이지 즐겨찾기.
// localStorage persist로 브라우저별 분리. 인증 사이클 도입 시 user id 기반
// Favorite 모델로 마이그레이션 예정. orphan ID는 Sidebar 렌더 시점에 spaces
// 데이터와 join으로 자동 누락 (무해).
type FavoritesState = {
  ids: string[];
  isFavorite: (pageId: string) => boolean;
  toggle: (pageId: string) => void;
  remove: (pageId: string) => void;
};

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      ids: [],
      isFavorite: (pageId) => get().ids.includes(pageId),
      toggle: (pageId) =>
        set((s) => ({
          ids: s.ids.includes(pageId)
            ? s.ids.filter((x) => x !== pageId)
            : [...s.ids, pageId],
        })),
      remove: (pageId) =>
        set((s) => ({ ids: s.ids.filter((x) => x !== pageId) })),
    }),
    {
      name: "docspace-favorites",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
