"use client";

import { useEffect, useState } from "react";
import { useStarredSpacesStore } from "@/lib/stores/useStarredSpacesStore";

// Cycle 29 (별표) — 스페이스 별표 토글 버튼. Confluence 패턴:
//   starred → ⭐ + "내 공간에서 제거" 툴팁
//   unstar → ☆ + "내 공간에 추가" 툴팁
//
// 부모 카드에 hover-only opacity를 적용하려면 alwaysVisible=false (기본).
// 항상 보이려면 alwaysVisible=true.
//
// 주의 — 카드 전체가 <button>인 경우(예: /home SpaceCard) 이 버튼은
// 그 카드의 sibling으로 배치되어야 한다. nested <button>은 invalid HTML이라
// 브라우저가 클릭을 카드 button으로 전달할 수 있다.

type Props = {
  spaceId: string;
  size?: "sm" | "md";
  alwaysVisible?: boolean;
  className?: string;
};

export default function SpaceStarButton({
  spaceId,
  size = "md",
  alwaysVisible = false,
  className = "",
}: Props) {
  // SSR 시점에는 localStorage가 없어 zustand persist 가 ids=[]로 시작한다.
  // 클라이언트 hydrate 이후에야 실제 starred 상태가 적용되도록 mounted 가드.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const starred = useStarredSpacesStore((s) =>
    mounted ? s.ids.includes(spaceId) : false,
  );
  const toggle = useStarredSpacesStore((s) => s.toggle);

  const dim = size === "sm" ? "text-[14px] w-6 h-6" : "text-[18px] w-8 h-8";
  const visibility = alwaysVisible
    ? ""
    : "opacity-0 group-hover:opacity-100 focus:opacity-100";
  const color = starred
    ? "text-[#ffab00] hover:bg-[#ffe6c2]"
    : "text-[#a5adba] hover:text-[#ffab00] hover:bg-[#ebecf0]";

  return (
    <button
      type="button"
      aria-label={starred ? "내 공간에서 제거" : "내 공간에 추가"}
      title={starred ? "내 공간에서 제거" : "내 공간에 추가"}
      onClick={() => toggle(spaceId)}
      className={`inline-flex items-center justify-center rounded transition-colors ${dim} ${visibility} ${color} ${className}`}
    >
      {starred ? "⭐" : "☆"}
    </button>
  );
}
