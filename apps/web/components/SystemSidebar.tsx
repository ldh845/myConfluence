"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { SpaceWithPages } from "@/lib/types";
import { useStarredSpacesStore } from "@/lib/stores/useStarredSpacesStore";
import SpaceStarButton from "@/components/SpaceStarButton";

// Cycle 29 — 시스템 홈(/home) 사이드바.
// 발견 / 내 작업 sub-item 은 /home?view=<id> 로 view 전환.
// 내 공간 행은 그 스페이스로 진입 (/?pageId=<첫 페이지> 또는 /?spaceId=<id>).

type SubItem = { id: string; label: string };

const DISCOVER_ITEMS: SubItem[] = [
  { id: "updates", label: "모든 변경사항" },
];

const MYWORK_ITEMS: SubItem[] = [
  { id: "recent", label: "최근 작업" },
  { id: "visited", label: "최근 방문" },
  { id: "saved", label: "나중을 위해 저장" },
];

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[#6b778c]">
      {children}
    </div>
  );
}

function SubItemLink({
  view,
  active,
  children,
}: {
  view: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={`/home?view=${view}`}
      className={`w-full flex items-center gap-2 pl-7 pr-3 py-1.5 rounded text-[13px] text-left ${
        active
          ? "bg-[#deebff] text-[#0052cc] font-semibold"
          : "text-[#172b4d] hover:bg-[#ebecf0]"
      }`}
    >
      {children}
    </Link>
  );
}

export default function SystemSidebar() {
  const router = useRouter();
  const params = useSearchParams();
  const currentView = params.get("view") ?? "updates";

  const { data: spacesData } = useQuery<SpaceWithPages[]>({
    queryKey: ["spaces"],
    queryFn: async () => {
      const r = await fetch("/api/spaces");
      if (!r.ok) return [];
      return (await r.json()) as SpaceWithPages[];
    },
  });
  // Cycle 29 (별표) — "내 공간"은 별표한 스페이스만.
  const starredIds = useStarredSpacesStore((s) => s.ids);
  const spaces = (spacesData ?? []).filter((s) => starredIds.includes(s.id));

  const enterSpace = (sp: SpaceWithPages) => {
    const first = sp.pages[0];
    if (first) router.push(`/?pageId=${first.id}`);
    else router.push(`/?spaceId=${sp.id}`);
  };

  return (
    <aside className="w-[260px] shrink-0 bg-[#f4f5f7] border-r border-[#dfe1e6] h-full overflow-y-auto flex flex-col">
      {/* 발견 */}
      <SectionHeader>발견</SectionHeader>
      <div className="px-2 space-y-0.5">
        {DISCOVER_ITEMS.map((s) => (
          <SubItemLink key={s.id} view={s.id} active={currentView === s.id}>
            {s.label}
          </SubItemLink>
        ))}
      </div>

      {/* 내 작업 */}
      <SectionHeader>내 작업</SectionHeader>
      <div className="px-2 space-y-0.5">
        {MYWORK_ITEMS.map((s) => (
          <SubItemLink key={s.id} view={s.id} active={currentView === s.id}>
            {s.label}
          </SubItemLink>
        ))}
      </div>

      {/* 내 공간 — 별표한 스페이스만 */}
      <SectionHeader>내 공간</SectionHeader>
      <div className="px-2 pb-4 space-y-0.5">
        {spaces.length === 0 ? (
          <div className="pl-7 pr-3 py-1.5 text-[12px] text-[#6b778c]">
            별표한 공간이 없습니다. 상단 공간 메뉴에서 ☆을 눌러 추가하세요.
          </div>
        ) : (
          spaces.map((sp) => (
            <div key={sp.id} className="group flex items-center">
              <button
                type="button"
                onClick={() => enterSpace(sp)}
                title={sp.description ?? sp.name}
                className="flex-1 flex items-center gap-2 pl-4 pr-1 py-1.5 rounded text-[13px] text-left text-[#172b4d] hover:bg-[#ebecf0]"
              >
                <div className="w-5 h-5 rounded bg-[#0052cc] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                  {sp.name.slice(0, 1).toUpperCase()}
                </div>
                <span className="flex-1 truncate">{sp.name}</span>
                <span className="text-[11px] text-[#6b778c]">
                  {sp.pages.length}
                </span>
              </button>
              <SpaceStarButton
                spaceId={sp.id}
                size="sm"
                className="mr-2"
              />
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
