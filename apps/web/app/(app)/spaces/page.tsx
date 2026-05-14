"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import SpaceStarButton from "@/components/SpaceStarButton";
import type { SpaceWithPages } from "@/lib/types";

// Cycle 29 — 공간 목록(디렉터리). TopNav 공간 드롭다운의 "공간 목록"에서 진입.
// 모든 공간을 카드 그리드로 보여주고, 별표(☆/★)로 "내 공간" 추가/제거.

export default function SpacesPage() {
  const router = useRouter();

  const { data: spaces } = useQuery<SpaceWithPages[]>({
    queryKey: ["spaces"],
    queryFn: async () => {
      const r = await fetch("/api/spaces");
      if (!r.ok) return [];
      return (await r.json()) as SpaceWithPages[];
    },
  });

  const enterSpace = (sp: SpaceWithPages) => {
    const first = sp.pages[0];
    if (first) router.push(`/?pageId=${first.id}`);
    else router.push(`/?spaceId=${sp.id}`);
  };

  return (
    <div className="max-w-[880px] mx-auto px-6 pt-6 pb-16">
      <h1 className="text-[22px] font-semibold text-[#172b4d] mb-1">
        공간 목록
      </h1>
      <p className="text-[13px] text-[#6b778c] mb-6">
        ☆을 눌러 공간을 &lsquo;내 공간&rsquo;에 추가하면 사이드바와 홈에서
        빠르게 접근할 수 있습니다.
      </p>

      {!spaces ? (
        <div className="text-[12px] text-[#6b778c]">불러오는 중...</div>
      ) : spaces.length === 0 ? (
        <div className="text-[13px] text-[#6b778c] border border-dashed border-[#dfe1e6] rounded p-4">
          아직 공간이 없습니다. 상단 공간 메뉴의 &lsquo;공간 만들기&rsquo;로
          새 공간을 추가하세요.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {spaces.map((sp) => (
            <div
              key={sp.id}
              className="group relative border border-[#dfe1e6] rounded-md bg-white hover:border-[#0052cc] hover:bg-[#f4f5f7] transition-colors"
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => enterSpace(sp)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    enterSpace(sp);
                  }
                }}
                className="text-left p-4 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#0052cc] rounded-md"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded bg-[#0052cc] text-white flex items-center justify-center font-bold shrink-0">
                    {sp.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0 pr-9">
                    <div className="text-[14px] font-semibold text-[#172b4d] truncate">
                      {sp.name}
                    </div>
                    {sp.description && (
                      <div className="text-[12px] text-[#6b778c] truncate mt-0.5">
                        {sp.description}
                      </div>
                    )}
                    <div className="text-[11px] text-[#6b778c] mt-1">
                      페이지 {sp.pages.length}개
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute top-2 right-2 z-30">
                <SpaceStarButton spaceId={sp.id} size="md" alwaysVisible />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
