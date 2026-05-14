"use client";

import { useStarredSpacesStore } from "@/lib/stores/useStarredSpacesStore";

// Cycle 29 (별표) — 스페이스 별표 토글 버튼.
// 별표 클릭 시 ⭐/☆ 토글 + 콘솔에 로그 (디버그용).

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
  // 직접 store hook 사용 — 안정적 패턴 (useFavoritesStore와 동일).
  const starred = useStarredSpacesStore((s) => s.ids.includes(spaceId));
  const toggle = useStarredSpacesStore((s) => s.toggle);

  const dim = size === "sm" ? "text-[14px] w-6 h-6" : "text-[18px] w-8 h-8";
  const visibility = alwaysVisible
    ? ""
    : "opacity-0 group-hover:opacity-100 focus-within:opacity-100";
  const color = starred
    ? "text-[#ffab00] hover:bg-[#ffe6c2]"
    : "text-[#a5adba] hover:text-[#ffab00] hover:bg-[#ebecf0]";

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // eslint-disable-next-line no-console
    console.log("[SpaceStarButton] toggle", spaceId, "starred was:", starred);
    toggle(spaceId);
  };

  return (
    <button
      type="button"
      aria-label={starred ? "내 공간에서 제거" : "내 공간에 추가"}
      title={starred ? "내 공간에서 제거" : "내 공간에 추가"}
      onClick={handleClick}
      className={`relative z-10 inline-flex items-center justify-center rounded transition-colors cursor-pointer ${dim} ${visibility} ${color} ${className}`}
    >
      {starred ? "⭐" : "☆"}
    </button>
  );
}
