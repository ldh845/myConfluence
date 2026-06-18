import { create } from "zustand";

// Cycle 62 — 편집기 UI 전역 신호. slash command(.ts, React 밖)에서 React
// 다이얼로그를 직접 마운트할 수 없으므로, store 신호로 EditorToolbar 의
// ImageInsertDialog 를 연다. getState().openImageDialog() 는 React 밖에서도 호출 가능.
// Cycle 85 — 상태/정보 매크로 다이얼로그 신호 추가.
// Cycle 89 — 상태 매크로 더블클릭 편집: 기존 속성 전달.

export type StatusMacroAttrs = {
  text: string;
  color: string;
  pos: number;
};

type EditorUiState = {
  imageDialogOpen: boolean;
  openImageDialog: () => void;
  closeImageDialog: () => void;
  statusMacroOpen: boolean;
  editingStatusAttrs: StatusMacroAttrs | null;
  openStatusMacro: (attrs?: StatusMacroAttrs) => void;
  closeStatusMacro: () => void;
  infoPanelDialogOpen: boolean;
  openInfoPanelDialog: () => void;
  closeInfoPanelDialog: () => void;
};

export const useEditorUiStore = create<EditorUiState>((set) => ({
  imageDialogOpen: false,
  openImageDialog: () => set({ imageDialogOpen: true }),
  closeImageDialog: () => set({ imageDialogOpen: false }),
  statusMacroOpen: false,
  editingStatusAttrs: null,
  openStatusMacro: (attrs) =>
    set({ statusMacroOpen: true, editingStatusAttrs: attrs ?? null }),
  closeStatusMacro: () =>
    set({ statusMacroOpen: false, editingStatusAttrs: null }),
  infoPanelDialogOpen: false,
  openInfoPanelDialog: () => set({ infoPanelDialogOpen: true }),
  closeInfoPanelDialog: () => set({ infoPanelDialogOpen: false }),
}));