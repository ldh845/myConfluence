"use client";

import { useStarredSpacesStore } from "@/lib/stores/useStarredSpacesStore";

// Cycle 29 (별표) — 스페이스 별표 토글 버튼. Confluence 패턴:
//   starred → ⭐ (불투명 노란색) + "내 공간에서 제거" 툴팁
//   unstar → ☆ (회색 outline) + "내 공간에 추가" 툴팁
//
// 상위 카드에 hover-only opacity를 적용하려면 alwaysVisible=false (기본).
// 항상 보이려면 alwaysVisible=true.

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

  const dim = size === "sm" ? "text-[13px] w-5 h-5" : "text-[16px] w-7 h-7";
  const visibility = alwaysVisible
    ? ""
    : "opacity-0 group-hover:opacity-100 focus:opacity-100";
  const color = starred
    ? "text-[#ffab00] hover:text-[#ff8b00]"
    : "text-[#a5adba] hover:text-[#ffab00]";

  return (
    <button
      type="button"
      aria-label={starred ? "내 공간에서 제거" : "내 공간에 추가"}
      title={starred ? "내 공간에서 제거" : "내 공간에 추가"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(spaceId);
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className={`inline-flex items-center justify-center rounded transition-opacity ${dim} ${visibility} ${color} ${className}`}
    >
      {starred ? "⭐" : "☆"}
    </button>
  );
}
