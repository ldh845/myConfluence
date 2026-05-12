"use client";

import Link from "next/link";

// FR-130 (Cycle 22) — 홈 카드 안의 페이지 항목.
// 클릭 시 `/?pageId=<id>`로 SPA 라우팅. Next Link로 prefetch + middle-click 새 탭 호환.

type Props = {
  id: string;
  title: string;
  spaceName?: string | null;
  subtitle?: string;
  icon?: string;
};

export default function PageCard({
  id,
  title,
  spaceName,
  subtitle,
  icon = "📄",
}: Props) {
  return (
    <Link
      href={`/?pageId=${id}`}
      className="block border border-[#dfe1e6] rounded-md p-3 hover:border-[#0052cc] hover:bg-[#f4f5f7] transition-colors"
    >
      <div className="flex items-start gap-2">
        <span className="text-[16px] leading-none mt-0.5">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-medium text-[#172b4d] truncate">
            {title || "(제목 없음)"}
          </div>
          {(spaceName || subtitle) && (
            <div className="text-[11px] text-[#6b778c] mt-0.5 truncate">
              {spaceName && <span>{spaceName}</span>}
              {spaceName && subtitle && <span> · </span>}
              {subtitle}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
