"use client";

import Image from "next/image";
import { useStarredSpacesStore } from "@/lib/stores/useStarredSpacesStore";

// Cycle 29 (별표) — 스페이스 별표 토글.
// public/icons/star.png(불투명) ↔ star_outline.png(외곽선) PNG 두 장으로 토글.

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

  const px = size === "sm" ? 12 : 14;
  const box = size === "sm" ? "w-5 h-5" : "w-6 h-6";
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
        e.preventDefault();
        // eslint-disable-next-line no-console
        console.log("[SpaceStarButton] toggle", spaceId, "starred was:", starred);
        toggle(spaceId);
      }}
      onMouseDown={(e) => e.stopPropagation()}
      className={`inline-flex items-center justify-center rounded hover:bg-[#ebecf0] cursor-pointer ${box} ${visibility} ${className}`}
      style={{ pointerEvents: "auto" }}
    >
      <Image
        src={starred ? "/icons/star.png" : "/icons/star_outline.png"}
        alt={starred ? "starred" : "not starred"}
        width={px}
        height={px}
        draggable={false}
        priority={false}
      />
    </button>
  );
}
