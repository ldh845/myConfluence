import { create } from "zustand";

// Cycle 10-2b-2 — TaskItemNodeView가 조회 모드에서 즉시 발행할 때 pageId와
// authorName이 필요한데, NodeView는 props를 받을 수 없다. page.tsx가
// currentPage 변경 시 store를 업데이트하고, NodeView는 selector로 구독한다.
type PageState = {
  pageId: string | null;
  authorName: string;
  setPage: (pageId: string, authorName: string) => void;
  reset: () => void;
};

export const usePageStore = create<PageState>((set) => ({
  pageId: null,
  authorName: "익명",
  setPage: (pageId, authorName) => set({ pageId, authorName }),
  reset: () => set({ pageId: null, authorName: "익명" }),
}));
