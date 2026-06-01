import { create } from "zustand";

// Cycle 62 — 편집기 UI 전역 신호. slash command(.ts, React 밖)에서 React
// 다이얼로그를 직접 마운트할 수 없으므로, store 신호로 EditorToolbar 의
// ImageInsertDialog 를 연다. getState().openImageDialog() 는 React 밖에서도 호출 가능.
// Cycle 85 — 상태/정보 매크로 다이얼로그 신호 추가.
type EditorUiState = {
  imageDialogOpen: boolean;
  openImageDialog: () => void;
  closeImageDialog: () => void;
  statusMacroOpen: boolean;
  openStatusMacro: () => void;
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
  openStatusMacro: () => set({ statusMacroOpen: true }),
  closeStatusMacro: () => set({ statusMacroOpen: false }),
  infoPanelDialogOpen: false,
  openInfoPanelDialog: () => set({ infoPanelDialogOpen: true }),
  closeInfoPanelDialog: () => set({ infoPanelDialogOpen: false }),
}));
