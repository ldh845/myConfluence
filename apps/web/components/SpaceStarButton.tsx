"use client";

import { useStarredSpacesStore } from "@/lib/stores/useStarredSpacesStore";

// Cycle 29 (별표) — 스페이스 별표 토글 버튼.
// 호버에 자체 hover 강조, 클릭 시 즉시 색이 채워지고 store에 반영.
// 별표 컴포넌트는 단순 <button> 하나 — 부모는 <div> 여야 함(nested button 회피).

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
  const starred = useStarredSpacesStore((s) => s.ids.includes(spaceId));
  const toggle = useStarredSpacesStore((s) => s.toggle);

  const dim = size === "sm" ? "text-[14px] w-6 h-6" : "text-[18px] w-8 h-8";
  const visibility = alwaysVisible
    ? ""
    : "opacity-0 group-hover:opacity-100 focus-within:opacity-100";

  return (
    <button
      type="button"
      aria-label={starred ? "내 공간에서 제거" : "내 공간에 추가"}
      title={starred ? "내 공간에서 제거" : "내 공간에 추가"}
      onClick={(e) => {
        e.stopPropagation();
        toggle(spaceId);
      }}
      style={{ color: starred ? "#ffab00" : "#a5adba" }}
      className={`relative z-20 inline-flex items-center justify-center rounded transition-colors cursor-pointer hover:bg-[#ebecf0] ${dim} ${visibility} ${className}`}
    >
      {starred ? "★" : "☆"}
    </button>
  );
}
