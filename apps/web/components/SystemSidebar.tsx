"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { SpaceWithPages } from "@/lib/types";

// Cycle 29 — 시스템 홈(/home) 전용 사이드바.
// Confluence Cloud 패턴: h2 섹션 헤더(발견 / 내 작업 / 내 공간) + sub-item.
// 발견 sub-item과 내 작업 sub-item은 anchor scroll, 내 공간 sub-item은 스페이스 진입.

type SubItem = { id: string; label: string };

const DISCOVER_ITEMS: SubItem[] = [
  { id: "discover-updates", label: "모든 변경사항" },
];

const MYWORK_ITEMS: SubItem[] = [
  { id: "mywork-recent", label: "최근 작업" },
  { id: "mywork-visited", label: "최근 방문" },
  { id: "mywork-saved", label: "나중을 위해 저장" },
];

const ALL_ANCHOR_IDS = [...DISCOVER_ITEMS, ...MYWORK_ITEMS].map((s) => s.id);

function SectionHeader({
  icon,
  children,
}: {
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 pt-4 pb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#6b778c]">
      <span className="text-[13px] leading-none">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

function SubItemRow({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2 pl-7 pr-3 py-1.5 rounded text-[13px] text-left ${
        active
          ? "bg-[#deebff] text-[#0052cc] font-semibold"
          : "text-[#172b4d] hover:bg-[#ebecf0]"
      }`}
    >
      {children}
    </button>
  );
}

export default function SystemSidebar() {
  const router = useRouter();
  const [active, setActive] = useState<string>(ALL_ANCHOR_IDS[0]);

  const { data: spacesData } = useQuery<SpaceWithPages[]>({
    queryKey: ["spaces"],
    queryFn: async () => {
      const r = await fetch("/api/spaces");
      if (!r.ok) return [];
      return (await r.json()) as SpaceWithPages[];
    },
  });
  const spaces = spacesData ?? [];

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActive(id);
    }
  }, []);

  // 사이드바 sub-item 스크롤 따라가기. <main overflow-auto>가 스크롤 컨테이너.
  useEffect(() => {
    const root = document.querySelector("main");
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { root, rootMargin: "-30% 0px -60% 0px", threshold: 0 },
    );
    ALL_ANCHOR_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const enterSpace = (sp: SpaceWithPages) => {
    const first = sp.pages[0];
    if (first) router.push(`/?pageId=${first.id}`);
    else router.push(`/?spaceId=${sp.id}`);
  };

  return (
    <aside className="w-[260px] shrink-0 bg-[#f4f5f7] border-r border-[#dfe1e6] h-full overflow-y-auto flex flex-col">
      {/* 발견 */}
      <SectionHeader icon="🧭">발견</SectionHeader>
      <div className="px-2 space-y-0.5">
        {DISCOVER_ITEMS.map((s) => (
          <SubItemRow
            key={s.id}
            active={active === s.id}
            onClick={() => scrollTo(s.id)}
          >
            {s.label}
          </SubItemRow>
        ))}
      </div>

      {/* 내 작업 */}
      <SectionHeader icon="💼">내 작업</SectionHeader>
      <div className="px-2 space-y-0.5">
        {MYWORK_ITEMS.map((s) => (
          <SubItemRow
            key={s.id}
            active={active === s.id}
            onClick={() => scrollTo(s.id)}
          >
            {s.label}
          </SubItemRow>
        ))}
      </div>

      {/* 내 공간 */}
      <SectionHeader icon="🌐">내 공간</SectionHeader>
      <div className="px-2 pb-4 space-y-0.5">
        {spaces.length === 0 ? (
          <div className="pl-7 pr-3 py-1.5 text-[12px] text-[#6b778c]">
            가입한 공간이 없습니다.
          </div>
        ) : (
          spaces.map((sp) => (
            <button
              key={sp.id}
              type="button"
              onClick={() => enterSpace(sp)}
              title={sp.description ?? sp.name}
              className="w-full flex items-center gap-2 pl-4 pr-3 py-1.5 rounded text-[13px] text-left text-[#172b4d] hover:bg-[#ebecf0]"
            >
              <div className="w-5 h-5 rounded bg-[#0052cc] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                {sp.name.slice(0, 1).toUpperCase()}
              </div>
              <span className="flex-1 truncate">{sp.name}</span>
              <span className="text-[11px] text-[#6b778c]">
                {sp.pages.length}
              </span>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
