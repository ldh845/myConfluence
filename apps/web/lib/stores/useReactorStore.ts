import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// FR-073 (Cycle 25) — 익명 reactor 식별자.
// 브라우저 첫 진입 시 UUID 자동 생성, localStorage persist. 인증 도입 시
// 사용자 id 기반으로 마이그레이션.

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `r-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

type ReactorState = {
  reactorId: string;
  reactorName: string | null;
  setName: (name: string | null) => void;
};

export const useReactorStore = create<ReactorState>()(
  persist(
    (set) => ({
      reactorId: genId(),
      reactorName: null,
      setName: (name) => set({ reactorName: name }),
    }),
    {
      name: "docspace-reactor",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
